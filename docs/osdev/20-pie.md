# Position Independent Executable (PIE)

Fusion is a single address space OS, which means that all tasks share the same address space. This requires the ability to load task images at arbitrary addresses (depending on the available virtual memory). Currently, when we compile and link a task, the linker will generate a binary that is not position independent. We need to change this and use position independent executables (PIE).

## What is PIE and PIC?

A PIE is a binary that can be loaded at any address in memory. This is achieved by using relative addressing instead of absolute addressing. For example, instead of using the absolute address of a function, the compiler uses the offset from the current instruction pointer. This is called position independent code (PIC), and is typically used for shared libraries, since they can be loaded at any address in the process address space. To generate PIC object files, we need to use the `-fPIC` compiler flag. A PIE can be generated using the `--pie` linker flag, assuming that all object files are PIC.

In some cases, however, the linker cannot use relative addressing for some symbols. In particular, global variables that contain pointers to other global variables or functions cannot be resolved at link time. This is because the linker does not know the address of the target symbol at link time, and therefore cannot compute the offset. In this case, the linker will generate a relocation entry, which is a record that tells the loader to patch the binary at runtime. The loader will then resolve the relocation entries and patch the binary before starting the task.

This process is typical in loading shared libraries, but it is also used for PIEs. There are two types of PIEs: dynamic and static.

- A **dynamic PIE** relies on the same dynamic linker as shared libraries, and therefore need to be loaded by the dynamic linker (typically `ld.so`).
- A **static PIE**, on the other hand, does not need a dynamic linker. Instead, it relies on C runtime startup code that is linked into the binary (typically `Scrt1.o`). The startup code applies the relocation entries by patching the loaded binary in memory.

What we want is a static PIE, but since we do not have a C runtime, we need to implement the relocation patching ourselves.

## Generating a static PIE

Let's modify the user task `nim.cfg` file to generate a static PIE.

```properties
# src/user/nim.cfg

...
--passc:"-fPIC"

...
--passl:"--pie"
```

Let's also remove the fixed address from the linker script, since the whole point of a PIE is to be able to load it at any address.

```ld
/* src/user/utask.ld */

SECTIONS
{
  . = 0x00000000040000000; /* 1 GiB */    <-- remove this line
  ...
}
```

Now, let's compile and link the task and take a look at the generated binary.

```sh-session
$ just user
...

$ file build/user/utask.bin
build/user/utask.bin: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, not stripped
```

Good, we have a static PIE. Before we try it out, let's take a look at the generated sections in the binary. To do this, we need to temporarily comment out the use of the linker script and the binary output format to generate a vanilla ELF binary that we can inspect.

```properties
# src/user/nim.cfg

...
#--passl:"-T src/user/utask.ld"
#--passl:"--oformat=binary"
```

Let's use `llvm-readelf` to inspect the sections in the binary.

```sh-session
$ llvm-readelf -S build/user/utask.bin
There are 18 section headers, starting at offset 0xd300:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .dynsym           DYNSYM          0000000000000200 000200 000018 18   A  4   1  8
  [ 2] .gnu.hash         GNU_HASH        0000000000000218 000218 00001c 00   A  1   0  8
  [ 3] .hash             HASH            0000000000000234 000234 000010 04   A  1   0  4
  [ 4] .dynstr           STRTAB          0000000000000244 000244 000001 00   A  0   0  1
  [ 5] .rela.dyn         RELA            0000000000000248 000248 000300 18   A  1   0  8
  [ 6] .rodata           PROGBITS        0000000000000550 000550 000bb0 00 AMS  0   0 16
  [ 7] .text             PROGBITS        0000000000002100 001100 008c3a 00  AX  0   0 16
  [ 8] .data.rel.ro      PROGBITS        000000000000bd40 009d40 000180 00  WA  0   0 16
  [ 9] .dynamic          DYNAMIC         000000000000bec0 009ec0 0000d0 10  WA  4   0  8
  [10] .got              PROGBITS        000000000000bf90 009f90 000000 00  WA  0   0  8
  [11] .relro_padding    NOBITS          000000000000bf90 009f90 000070 00  WA  0   0  1
  [12] .data             PROGBITS        000000000000cf90 009f90 0000e0 00  WA  0   0  8
  [13] .bss              NOBITS          000000000000d070 00a070 2004a8 00  WA  0   0 16
  [14] .comment          PROGBITS        0000000000000000 00a070 00007d 01  MS  0   0  1
  [15] .symtab           SYMTAB          0000000000000000 00a0f0 001848 18     17 258  8
  [16] .shstrtab         STRTAB          0000000000000000 00b938 000091 00      0   0  1
  [17] .strtab           STRTAB          0000000000000000 00b9c9 001930 00      0   0  1
```

There's a lot of sections here, but we'll focus on code (text) and data sections. In addition to the usual ones (`.text`, `.rodata`, `.data`, and `.bss`), a new data section shows up: `.data.rel.ro`. This is a read-only data section (similar to `.rodata`) that contains data that needs to be relocated. We'll look at relocations later, but for now let's just include this section in the linker script.

```ld{9}
SECTIONS
{
  .text : {
    *utask*.o(.*text.UserMain)
    *utask*.o(.*text.*)
    *(.*text*)
  }
  .rodata      : { *(.*rodata*) }
  .data        : { *(.*data*) *(.*bss) }
  .data.rel.ro : { *(.data.rel.ro) }

  .shstrtab : { *(.shstrtab) } /* cannot be discarded */
  /DISCARD/ : { *(*) }
}
```

## Trying it out

Let's uncomment the lines we commented out earlier in the `nim.cfg` file (for the linker script and output format), and see what happens when we try to run it.

```sh-session
$ just run
...

kernel: Initializing Syscalls [success]
kernel: Creating user task
kernel: Switching to user mode
syscall: num=2
syscall: print

syscall: num=1
syscall: exit: code=0
```

It works, but there's no message printed from the user task (that we pass to the `print` syscall). Let's print the `arg1` argument value passed to the `print` syscall to see what address is being passed.

```nim
# src/user/syscalls.nim
...

proc print*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln &"syscall: print (arg1={args.arg1:#x})"
  ...
```

```sh-session
kernel: Switching to user mode
syscall: num=2
syscall: print (arg1=0x40209ee8)

syscall: num=1
syscall: exit: code=0
```

The `arg1` looks like a valid address, but for some reason nothing is printed. If we look at the linker map file at that address we can see that it's the address of the `msg` string:

```text{5}
    VMA              LMA        Size Align Out     In      Symbol
    ...
    209ee0           209ee0       18     8         build/user/@mutask.nim.c.o:(.bss)
    209ee0           209ee0        8     1                 pmsg__utask_u5
    209ee8           209ee8       10     1                 msg__utask_u4
```

This was very confusing to me before I learned about the need for relocation even in static PIEs. To understand what's going on, we need to look at how Nim defines its `string` type. The relevant definition is in `system/strs_v2.nim` in the Nim standard library.

```nim
type
  ...

  NimStrPayload {.core.} = object
    cap: int
    data: UncheckedArray[char]

  NimStringV2 {.core.} = object
    len: int
    p: ptr NimStrPayload ## can be nil if len == 0.
```

The `NimStrPayload` object contains the capacity of the string and the actual bytes making up the string. The `NimStringV2` object contains the length of the string and a **pointer** to a payload object (this is the `string` type normally used in Nim code). OK, so now we know that the `msg` variable is not the string itself, but a pair of length and pointer to the string. This is evident from the `Size` value in the linker map file: the `msg` variable takes up `0x10` (16) bytes: 8 bytes for the `len` field and 8 bytes for the `p` field.

So, let's find out what's stored in the fields of the `msg` string variable.

```nim
# src/user/syscalls.nim
...

proc print*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln &"syscall: print (arg1={args.arg1:#x})"
  debugln &"syscall: print: arg1.len = {cast[ptr uint64](args.arg1)[]}"
  debugln &"syscall: print: arg1.p   = {cast[ptr uint64](args.arg1 + 8)[]:#x}"
  ...
```

```text
kernel: Creating user task
kernel: Switching to user mode
syscall: num=2
syscall: print (arg1=0x40209ee8)
syscall: print: arg1[0]=21
syscall: print: arg1[1]=0x0

syscall: num=1
syscall: exit: code=0
```

Well, the `len` field is correct, but the `p` field is `0x0`. This is the situation I talked about above: we have a global pointer (the `p` field of `NimStringV2`) that points to another global variable (the `NimStrPayload` object). The linker cannot resolve this at link time for a PIE, so it sets it to 0, and generates a relocation entry for the loader to use for patching that location at load time (once the actual location of the binary is known). That's what we need to do to make this work.

## Understanding relocations

Let's take a look at the sections in the binary again.

```sh-session{11}
$ llvm-readelf -S build/user/utask.bin
There are 18 section headers, starting at offset 0xd300:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .dynsym           DYNSYM          0000000000000200 000200 000018 18   A  4   1  8
  [ 2] .gnu.hash         GNU_HASH        0000000000000218 000218 00001c 00   A  1   0  8
  [ 3] .hash             HASH            0000000000000234 000234 000010 04   A  1   0  4
  [ 4] .dynstr           STRTAB          0000000000000244 000244 000001 00   A  0   0  1
  [ 5] .rela.dyn         RELA            0000000000000248 000248 000300 18   A  1   0  8
  [ 6] .rodata           PROGBITS        0000000000000550 000550 000bb0 00 AMS  0   0 16
  [ 7] .text             PROGBITS        0000000000002100 001100 008c3a 00  AX  0   0 16
  [ 8] .data.rel.ro      PROGBITS        000000000000bd40 009d40 000180 00  WA  0   0 16
  [ 9] .dynamic          DYNAMIC         000000000000bec0 009ec0 0000d0 10  WA  4   0  8
  [10] .got              PROGBITS        000000000000bf90 009f90 000000 00  WA  0   0  8
  [11] .relro_padding    NOBITS          000000000000bf90 009f90 000070 00  WA  0   0  1
  [12] .data             PROGBITS        000000000000cf90 009f90 0000e0 00  WA  0   0  8
  [13] .bss              NOBITS          000000000000d070 00a070 2004a8 00  WA  0   0 16
  [14] .comment          PROGBITS        0000000000000000 00a070 00007d 01  MS  0   0  1
  [15] .symtab           SYMTAB          0000000000000000 00a0f0 001848 18     17 258  8
  [16] .shstrtab         STRTAB          0000000000000000 00b938 000091 00      0   0  1
  [17] .strtab           STRTAB          0000000000000000 00b9c9 001930 00      0   0  1
```

This time we'll focus on the section containing the relocation entries: `.rela.dyn` (notice that its type is `RELA`, which is short for RELocations with Addend). Let's take a look at the relocation entries (I''ll use `llvm-objdump -R` here instead of `llvm-readelf -r` since interpreting its output is more straightforward).

```sh-session
$ llvm-objdump -R build/user/utask.bin

build/user/utask.bin:   file format elf64-x86-64

DYNAMIC RELOCATION RECORDS
OFFSET           TYPE                     VALUE
000000000000bd48 R_X86_64_RELATIVE        *ABS*+0xd38
000000000000bd58 R_X86_64_RELATIVE        *ABS*+0xd58
000000000000bd68 R_X86_64_RELATIVE        *ABS*+0xd90
000000000000bd78 R_X86_64_RELATIVE        *ABS*+0xda0
000000000000bd88 R_X86_64_RELATIVE        *ABS*+0xdb8
000000000000bd98 R_X86_64_RELATIVE        *ABS*+0xdd8
000000000000bda8 R_X86_64_RELATIVE        *ABS*+0xde8
000000000000bdb8 R_X86_64_RELATIVE        *ABS*+0xdf8
000000000000bdc8 R_X86_64_RELATIVE        *ABS*+0xe08
000000000000bdd8 R_X86_64_RELATIVE        *ABS*+0xdf8
000000000000bde8 R_X86_64_RELATIVE        *ABS*+0xe28
000000000000bdf8 R_X86_64_RELATIVE        *ABS*+0xe38
000000000000be08 R_X86_64_RELATIVE        *ABS*+0xe48
000000000000be18 R_X86_64_RELATIVE        *ABS*+0xe70
000000000000be28 R_X86_64_RELATIVE        *ABS*+0xea0
000000000000be38 R_X86_64_RELATIVE        *ABS*+0xeb0
000000000000be48 R_X86_64_RELATIVE        *ABS*+0xef0
000000000000be58 R_X86_64_RELATIVE        *ABS*+0xf70
000000000000be68 R_X86_64_RELATIVE        *ABS*+0xf90
000000000000be78 R_X86_64_RELATIVE        *ABS*+0x1000
000000000000be88 R_X86_64_RELATIVE        *ABS*+0x1010
000000000000be98 R_X86_64_RELATIVE        *ABS*+0x10b8
000000000000bea8 R_X86_64_RELATIVE        *ABS*+0x10c8
000000000000beb8 R_X86_64_RELATIVE        *ABS*+0x10e0
000000000000cf90 R_X86_64_RELATIVE        *ABS*+0x2100
000000000000cfa8 R_X86_64_RELATIVE        *ABS*+0x550
000000000000cfc8 R_X86_64_RELATIVE        *ABS*+0x2140
000000000000cfe0 R_X86_64_RELATIVE        *ABS*+0x560
000000000000d000 R_X86_64_RELATIVE        *ABS*+0x2180
000000000000d018 R_X86_64_RELATIVE        *ABS*+0x570
000000000000d038 R_X86_64_RELATIVE        *ABS*+0x21c0
000000000000d050 R_X86_64_RELATIVE        *ABS*+0x590
```

There are a lot of relocation entries here, but they all have the same type: `R_X86_64_RELATIVE`. Basically, this tells the loader to patch the binary at the given `OFFSET` by adding the addend `VALUE` to the base address where the binary is loaded (`*ABS*`). For example, the first entry tells the loader to patch the binary at offset `0xbd48` by adding the addend `0xd38` to the image base address.

If we look at those offsets, we can see that the first 24 entries are in the `.data.rel.ro` section, and the last 6 entries are in the `.data` section.

```text
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  ...
  [ 8] .data.rel.ro      PROGBITS        000000000000bd40 009d40 000180 00  WA  0   0 16
  ...
  [12] .data             PROGBITS        000000000000cf90 009f90 0000e0 00  WA  0   0  8
```

The `.data.rel.ro` section contains read-only data that needs to be relocated (often called RELRO). But how can it be read-only if it needs to be patched? The idea is to make the section read-only _after_ the relocation entries have been applied. The `.data` section contains read-write data, some of which also needs to be relocated.

Let's take a look at linker map file to see what is in these sections.

```text
    VMA              LMA     Size Align Out     In      Symbol
    ...
    bd40             bd40      180    16 .data.rel.ro
    bd40             bd40      120     8         build/user/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(.data.rel.ro)
    bd40             bd40       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_54
    bd50             bd50       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_56
    bd60             bd60       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_58
    bd70             bd70       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_60
    bd80             bd80       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_45
    bd90             bd90       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_65
    bda0             bda0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_67
    bdb0             bdb0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_72
    bdc0             bdc0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_74
    bdd0             bdd0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_77
    bde0             bde0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_81
    bdf0             bdf0       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_83
    be00             be00       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_9
    be10             be10       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_70
    be20             be20       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_7
    be30             be30       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_85
    be40             be40       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_87
    be50             be50       10     1                 TM__Q5wkpxktOdTGvlSRo9bzt9aw_90
    be60             be60       10     8         build/user/@m..@scommon@suefi.nim.c.o:(.data.rel.ro)
    be60             be60       10     1                 TM__pmebpDrnfB5mBIQZTCopKw_3
    be70             be70       10     8         build/user/@m..@scommon@slibc.nim.c.o:(.data.rel.ro)
    be70             be70       10     1                 TM__yBWtCXgKzcQMoAZ89cNTLsQ_9
    be80             be80       20    16         build/user/@m..@skernel@sdebugcon.nim.c.o:(.data.rel.ro)
    be80             be80       10     1                 TM__1g8zrI6ncbiETa2P7NNF9bg_4
    be90             be90       10     1                 TM__1g8zrI6ncbiETa2P7NNF9bg_6
    bea0             bea0       10    16         build/user/@m..@scommon@smalloc.nim.c.o:(.data.rel.ro)
    bea0             bea0       10     1                 TM__DFVzADEzeiwVkSytAkgKSQ_4
    beb0             beb0       10     8         build/user/@mutask.nim.c.o:(.data.rel.ro)
    beb0             beb0       10     1                 TM__ZYeLyBLx1ZJA3JEc71VOcA_3
    ...
    cf90             cf90       e0     8 .data
    cf90             cf90       e0     8         build/user/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sexceptions.nim.c.o:(.data)
    cf90             cf90       38     1                 NTIv2__KZk2hR9c7XDat5d89bT8RgRA_
    cfc8             cfc8       38     1                 NTIv2__sUSFsM69cxbQEmaJuFxUD8w_
    d000             d000       38     1                 NTIv2__nv8HG9cQ7K8ZPnb0AFnX9cYQ_
    d038             d038       38     1                 NTIv2__CrB9bTWm1Xdf09bhlG9cbbyPA_
```

The mangled symbols in the linker map file are Nim-generated C symbols, so it's hard to tell what they are. But let's take the one symbol defined in the `build/user/@mutask.nim.c.o` object file. If we look at the corresponding generated C code, we find that it's a pointer to a string struct (I included both the string struct and the pointer).

```c
static const struct {
  NI cap; NIM_CHAR data[21+1];
} TM__ZYeLyBLx1ZJA3JEc71VOcA_2 = { 21 | NIM_STRLIT_FLAG, "Hello from user mode!" };

static const NimStringV2 TM__ZYeLyBLx1ZJA3JEc71VOcA_3 = {21, (NimStrPayload*)&TM__ZYeLyBLx1ZJA3JEc71VOcA_2};
```

These are the two types we saw above: `NimStrPayload` and `NimStringV2`: `TM__ZYeLyBLx1ZJA3JEc71VOcA_2` is an instance of the `NimStrPayload` type (which contains the actual char array), and `TM__ZYeLyBLx1ZJA3JEc71VOcA_3` is an instance of the `NimStringV2` type (which contains the length and a pointer to the payload object).

Given that the address offset of the `NimStringV2` object is `0xbeb0` (as shown in the linker map file), and that the `p` field is at offset `8` in the struct (the `len` field takes 8 bytes), then the location to be patched is `0xbeb0 + 8 = 0xbeb8`. If we look at the relocation entries we saw above, indeed we can see an entry for this offset:

```text
000000000000beb8 R_X86_64_RELATIVE        *ABS*+0x10e0
```

So the loader is asked to patch that location by adding the addend `0x10e0` to the image base address. Let's see what's at that address in the linker map.

```text
    VMA              LMA     Size Align Out     In      Symbol
    ...
    10e0             10e0       20     8         build/user/@mutask.nim.c.o:(.rodata)
    10e0             10e0       20     1                 TM__ZYeLyBLx1ZJA3JEc71VOcA_2
```

Lo and behold, it's the `NimStrPayload` object we saw above. So the loader will patch the `p` pointer at offset `0xbeb8` by adding `0x10e0` to the image base address, which will make it point to the `NimStrPayload` object. Voilà!

## Raw binary with relocations

We don't have ELF support in our kernel (at least not yet), and I don't want to distract myself by implementing it now. So, we'll keep it simple and update the linker script to include the `.rela.dyn` section in the binary, and use it to patch the binary at load time. There's one problem though: the loader needs to know where the relocation entries are in the binary, and how many there are. We can add our own metadata section, but there's already one available as part of the ELF format: the `.dynamic` section. This section contains a list tags and values that are typically used by the dynamic linker, but we can also use it to locate the relocation entries. Let's take a quick look at that section using `llvm-readelf -d`.

```sh-session{6-9}
$ llvm-readelf -d build/user/utask.bin
Dynamic section at offset 0x9ec0 contains 13 entries:
  Tag                Type        Name/Value
  0x000000006ffffffb (FLAGS_1)   PIE 
  0x0000000000000015 (DEBUG)     0x0
  0x0000000000000007 (RELA)      0x248
  0x0000000000000008 (RELASZ)    768 (bytes)
  0x0000000000000009 (RELAENT)   24 (bytes)
  0x000000006ffffff9 (RELACOUNT) 32
  0x0000000000000006 (SYMTAB)    0x200
  0x000000000000000b (SYMENT)    24 (bytes)
  0x0000000000000005 (STRTAB)    0x244
  0x000000000000000a (STRSZ)     1 (bytes)
  0x000000006ffffef5 (GNU_HASH)  0x218
  0x0000000000000004 (HASH)      0x234
  0x0000000000000000 (NULL)      0x0
```

I highlighted the relevant entries. The `RELA` entry tells us where the relocation entries section (`.rela.dyn`) is located in the binary, the `RELASZ` entry tells us the size of that section, the `RELAENT` entry tells us the size of each relocation entry, and the `RELACOUNT` entry tells us how many relocation entries there are. It's exactly what we want. Also, notice that the last entry is always a NULL entry, so we can use that to locate the end of the section.

But where do we put the `.dynamic` section in the output image? If we put it in the middle (or end) of the image, we won't be able to locate it, so we'll need something else to locate it. Instead, we can just put it in the beginnning of the image, followed by the relocation entries, followed by the text and data sections. We just have to adjust our assumption that the entry point is not at the beginning of the image, but rather comes after the `.rela.dyn` section. Let's update the linker script to do so.

```ld{3-4}
SECTIONS
{
  .dynamic  : { *(.dynamic) }
  .rela.dyn : { *(.rela.dyn) }

  .text : {
    *utask*.o(.*text.UserMain)
    *utask*.o(.*text.*)
    *(.*text*)
  }
  .rodata      : { *(.*rodata*) }
  .data.rel.ro : { *(.data.rel.ro) }
  .data        : { *(.*data*) *(.*bss) }

  .shstrtab : { *(.shstrtab) } /* cannot be discarded */
  /DISCARD/ : { *(*) }
}
```

If we compile and link the task, we get the following error:

```text
ld.lld: error: section: .data.rel.ro is not contiguous with other relro sections
```

Apparently, some loaders support loading only a single RELRO segment (a segment in ELF maps to one or more contiguous sections). Both the `.dynamic` and `.data.rel.ro` sections are RELRO sections, so we need to make sure they are contiguous. We can fix it by putting the `.data.rel.ro` right after the `.dynamic` section.

```ld{4}
SECTIONS
{
  .dynamic     : { *(.dynamic) }
  .data.rel.ro : { *(.data.rel.ro) }
  .rela.dyn    : { *(.rela.dyn) }

  .text : {
    *utask*.o(.*text.UserMain)
    *utask*.o(.*text.*)
    *(.*text*)
  }
  .rodata      : { *(.*rodata*) }
  .data        : { *(.*data*) *(.*bss) }

  .shstrtab : { *(.shstrtab) } /* cannot be discarded */
  /DISCARD/ : { *(*) }
}
```

The user task should now compile and link successfully. If we look at the resulting sections, we should see the `.dynamic` section followed by the `.data.rel.ro` section followed by the `.rela.dyn` section.

```sh-session{7-9}
$ llvm-readelf -S build/user/utask.bin
There are 8 section headers, starting at offset 0x20b2e8:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .dynamic          DYNAMIC         0000000000000000 001000 0000b0 10  WA  0   0  8
  [ 2] .data.rel.ro      PROGBITS        00000000000000b0 0010b0 000180 00  WA  0   0 16
  [ 3] .rela.dyn         RELA            0000000000000230 001230 000300 18   A  0   0  8
  [ 4] .text             PROGBITS        0000000000000530 001530 008c34 00  AX  0   0 16
  [ 5] .rodata           PROGBITS        0000000000009170 00a170 000bb0 00 AMS  0   0 16
  [ 6] .data             PROGBITS        0000000000009d20 00ad20 200588 00  WA  0   0 16
  [ 7] .shstrtab         STRTAB          0000000000000000 20b2a8 00003f 00      0   0  1
```

## Applying the relocations

We now have a binary with relocation entries, so let's start by parsing the `.dynamic` section at the beginning of the image. Let's create a `loader.nim` module and define a `DynamicEntry` type to represent each entry, and a `DanamicEntryType` enum to represent the different types of entries. We'll also define an `applyRelocations` proc to parse the dynamic section.

```nim
# src/kernel/loader.nim

type
  DynamicEntry {.packed.} = object
    tag: uint64
    value: uint64

  DynmaicEntryType = enum
    Rela = 7
    RelaSize = 8
    RelaEntSize = 9
    RelaCount = 0x6ffffff9

proc applyRelocations*(image: ptr UncheckedArray[byte]): uint64 =
  ## Apply relocations to the image. Return the entry point address.
  var
    dyn = cast[ptr UncheckedArray[DynamicEntry]](image)
    reloffset = 0'u64
    relsize = 0'u64
    relentsize = 0'u64
    relcount = 0'u64

  var i = 0
  while dyn[i].tag != 0:
    case dyn[i].tag
    of DynmaicEntryType.Rela.uint64:
      reloffset = dyn[i].value
    of DynmaicEntryType.RelaSize.uint64:
      relsize = dyn[i].value
    of DynmaicEntryType.RelaEntSize.uint64:
      relentsize = dyn[i].value
    of DynmaicEntryType.RelaCount.uint64:
      relcount = dyn[i].value
    else:
      discard

    inc i

  if reloffset == 0 or relsize == 0 or relentsize == 0 or relcount == 0:
    raise newException(Exception, "Invalid dynamic section. Missing .dynamic information.")

  if relsize != relentsize * relcount:
    raise newException(Exception, "Invalid dynamic section. .rela.dyn size mismatch.")
```

The proc iterates over the dynamic entries until it finds the entries we're interested in (the ones describing the `.rela.dyn` section). It then checks that the values are valid.

Now that we know where the relocation entries are, let's parse them. We'll define a `RelaEntry` type to represent each entry, and a `RelaEntryType` enum to represent the different types of entries. We'll use these types to parse the `.rela.dyn` section.

```nim
# src/kernel/loader.nim

type
  ...

  RelaEntry {.packed.} = object
    offset: uint64
    info: uint64
    addend: int64

  RelaEntryType = enum
    Relative = 8

proc applyRelocations*(image: ptr UncheckedArray[byte]): uint64 =
  ...

  # rela points to the first relocation entry
  let rela = cast[ptr UncheckedArray[RelaEntry]](cast[uint64](image) + reloffset.uint64)

  for i in 0 ..< relcount:
    let relent = rela[i]
    if relent.info != RelaEntryType.Relative.uint64:
      raise newException(Exception, "Only relative relocations are supported.")
    # apply relocation
    let target = cast[ptr uint64](cast[uint64](image) + relent.offset)
    let value = cast[uint64](cast[int64](image) + relent.addend)
    target[] = value

  # entry point comes after .rela.dyn
  return cast[uint64](image) + reloffset + relsize
```

The proc iterates over the relocation entries and applies each one. The only type of relocation we support for now is relative relocation. For each relocation entry, we add the addend to the image base address and store the result at the offset specified by the relocation entry.

Finally, we return the entry point address, which comes right after the `.rela.dyn` section. This is the address we'll use to jump to user mode, instead of the fixed addess we had before.

Let's modify the `createTask` proc in `tasks.nim` to use the new `applyRelocations` proc. We'll remove the `entryPoint` argument (passed in `main.nim`), and use the return value of `applyRelocations` as the entry point address.

```nim
# src/kernel/tasks.nim
...

proc createTask*(
  imageVirtAddr: VirtAddr,
  imagePhysAddr: PhysAddr,
  imagePageCount: uint64,
): Task =
  ...

  # map user image
  ...

  # (temporarily) map the user image in kernel space
  mapRegion(
    pml4 = kspace.pml4,
    virtAddr = imageVirtAddr,
    physAddr = imagePhysAddr,
    pageCount = imagePageCount,
    pageAccess = paReadWrite,
    pageMode = pmSupervisor,
  )
  # apply relocations to user image
  debugln "kernel: Applying relocations to user image"
  let entryPoint = applyRelocations(cast[ptr UncheckedArray[byte]](imageVirtAddr))

  # map kernel space
  ...
```

Finanlly, we'll remove the `entryPoint` argument from call in `main.nim`.

```nim
# src/kernel/main.nim
...

proc KernelMain(bootInfo: ptr BootInfo) {.exportc.} =
  ...

  debugln "kernel: Creating user task"
  var task = createTask(
    imageVirtAddr = UserImageVirtualBase.VirtAddr,
    imagePhysAddr = bootInfo.userImagePhysicalBase.PhysAddr,
    imagePageCount = bootInfo.userImagePages,
  )

  ...
```

That should do it. Let's compile and run the kernel.

```sh-session
kernel: Creating user task
kernel: Applying relocations to user image
kernel: Switching to user mode
syscall: num=2
syscall: print (arg1=0x4020a298)
syscall: print: arg1[0]=21
syscall: print: arg1[1]=0x40009d00
Hello from user mode!
syscall: num=1
syscall: exit: code=0
```

It works! The message from the user task is printed correctly. We can see that the `arg1.p` value is now `0x40009d00` instead of `0`, which means that the relocation was applied correctly. To verify that we can load the task at any address, let's change the `UserImageVirtualBase` to something other than `0x40000000` and see if it still works.

```nim
# src/kernel/main.nim

const
  UserImageVirtualBase = 0x80000000
  UserStackVirtualBase = 0x90000000
```

```sh-session
kernel: Creating user task
kernel: Applying relocations to user image
kernel: Switching to user mode
syscall: num=2
syscall: print (arg1=0x8020a298)
syscall: print: arg1[0]=21
syscall: print: arg1[1]=0x80009d00
Hello from user mode!
syscall: num=1
syscall: exit: code=0
```

It still works! Notice that the `arg1.p` value is now `0x80009d00` instead of `0x40009d00`, which proves that we can now load the user task at any address.

This is another milestone; this means we can now load PIE tasks at any address, depending on the available virtual memory, and they all share the same address space. Keep in mind that we still need to have protection between tasks, so each task will still have its own page table mappings, but we won't have to rely on pre-arranging shared memory pages for inter-task communication. We'll get to that in a later section once we start tackling capabilities.

In the next section, we'll try to get two copies of the user task running at the same time, and try to switch between them using cooperative multitasking (we'll get to preemptive multitasking later).
