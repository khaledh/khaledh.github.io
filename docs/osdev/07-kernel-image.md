# Kernel Image

To start simple, we'll build a flat binary kernel image instead of using an executable format like PE or ELF. This makes the job of the bootloader easier, since it doesn't have to parse a complex executable format or fix up relocations. All it has to do is load the kernel image into memory and jump to the entry point.

## Project structure

Before we start writing the kernel, let's organize our project to separate the kernel from the bootloader modules, so that we can build them separately. Under the `src` directory we'll create a `boot` directory for the bootloader modules, and a `kernel` directory for the kernel modules. We'll also create a `common` directory for shared modules. Here's what the project structure looks like:

```
.
├── build
├── src
│   ├── boot
│   ├── common
│   └── kernel
└── nim.cfg
```

Now let's move the existing modules into their respective directories. Let's also create an empty `nim.cfg` file in the `boot` and `kernel` directories. We'll use these files to customize the build for the bootloader and the kernel. Nim will automatically pick up the `nim.cfg` file in the directory of the module that we're compiling. It also will recursively look for `nim.cfg` files in the parent directories. This allows us to have a common `nim.cfg` file in the project root directory, and provide specific configurations in the `nim.cfg` files in the `boot` and `kernel` directories.

```
.
├── build
├── src
│   ├── boot
│   │   ├── bootx64.nim
│   │   └── nim.cfg
│   ├── common
│   │   ├── libc.nim
│   │   ├── malloc.nim
│   │   └── uefi.nim
│   └── kernel
│       ├── main.nim
│       └── nim.cfg
└── nim.cfg
```

Let's move the following part of the `nim.cfg` file into the `nim.cfg` file in the `boot` directory:

```properties
--passC:"-target x86_64-unknown-windows"
--passC:"-ffreestanding"

--passL:"-target x86_64-unknown-windows"
--passL:"-fuse-ld=lld-link"
--passL:"-nostdlib"
--passL:"-Wl,-entry:EfiMain"
--passL:"-Wl,-subsystem:efi_application"
```

We'll work on what to use in the kernel's `nim.cfg` file later.

Let's also add a task in our `justfile` to build the the kernel:

```justfile{8-9}
# justfile

nimflags := "--os:any"

bootloader:
  nim c {{nimflags}} src/boot/bootx64.nim --out:build/bootx64.efi

kernel:
  nim c {{nimflags}} src/kernel/main.nim --out:build/kernel.bin

run: bootloader
  mkdir -p diskimg/efi/boot
  cp build/bootx64.efi diskimg/efi/boot/bootx64.efi
  qemu-system-x86_64 \
    -drive if=pflash,format=raw,file=ovmf/OVMF_CODE.fd,readonly=on \
    -drive if=pflash,format=raw,file=ovmf/OVMF_VARS.fd \
    -drive format=raw,file=fat:rw:diskimg \
    -machine q35 \
    -net none
```

## Debug output

 We cannot rely on any UEFI services in the kernel; the bootloader will exit UEFI Boot Services before jumping to the kernel. This means that we will not be able to use the UEFI console to print to the screen. The kernel will have to write directly to the graphics framebuffer, but we'll get to that later.

Typically, at this early stage of the kernel startup, the serial port is used to print debug messages. But I don't want to implement a serial port driver yet. Since we're using QEMU, we can leverage its debug console `debugcon` to print messages by configuring it to send its output to `stdio` using the switch `-debugcon stdio`. This will print the debug messages to the terminal that we're running QEMU from. The way this feature works is by sending characters to port `0xE9`, which is the debug port. Let's create a `debugcon` module implement procedures that prints a string to the debug console:

```nim
# src/debugcon.nim

const
  DebugConPort = 0xE9

proc portOut8(port: uint16, data: uint8) =
  asm """
    out %0, %1
    :
    :"Nd"(`port`), "a"(`data`)
  """

proc debug*(msgs: varargs[string]) =
  ## Send messages to the debug console.
  for msg in msgs:
    for ch in msg:
      portOut8(DebugConPort, ch.uint8)

proc debugln*(msgs: varargs[string]) =
  ## Send messages to the debug console. A newline is appended at the end.
  debug(msgs)
  debug("\r\n")
```

We can now use the `debug` and `debugln` procedures to print messages to the debug console.

## Entry point

The kernel entry point is the first function that is executed by the bootloader. We'll call this function `KernelMain`. For now, it will just print a message to the debug console and halt the CPU.

```nim
# src/kernel/main.nim

import debugcon, libc, malloc

proc KernelMain() {.exportc.} =
  debugln "Hello, world!"
  quit()
```

Similar to what we did in the bootloader, we import `libc` and `malloc` since we're compiling for a freestanding environment. Now let's see how we can compile this minimal kernel.

## Linking the kernel

Our goal is to build a raw binary kernel image. We can do this by passing the `--oformat=binary` switch to the linker. But before we do this, we have to understand how the bootloader will load the kernel image into memory and jump to the entry point.

A flat binary image doesn't have metadata to specify an entry point, so the bootloader and the kernel have to agree on a convention. The convention that we'll use is to place the entry point at the beginning of the image. This means that the bootloader will load the kernel image into memory and jump to the beginning of the image. Since the binary image is not relocatable, the kernel has to be linked at a specific address. We'll use the address `0x100000` (1 MiB) for the kernel image. The reason for this particular address is that below this address (specifically the region between 640 KiB to 1 MiB) is reserved for legacy BIOS compatibility (VGA memory, BIOS ROM, etc.) and is not accessible as RAM.

OK, how do we tell the linker to link the kernel at a specific address? We use a linker script. A linker script is a text file that tells the linker how to map sections from the input object files to sections in the output image, and in what order, and at what address. But before we use a linker script let's link the kernel without one, and see what sections are included in the output image.

The `lld-link` linker that we've been using so far (to generate a PE image) doesn't seem to support linker scripts (at least I couldn't find a way to do it). That's OK; we don't the PE format anymore, it was only needed for the UEFI bootloader. So for the kernel, we'll switch to using the `ld.lld` linker, which is the LLVM linker for Unix systems. The most widely used executable format on Unix systems is ELF, so we'll use that as well. We'll come back later to building a raw binary image.

Let's add some arguments in `src/kernel/nim.cfg` to use `ld.lld` and generate an ELF executable:

```properties
# src/kernel/nim.cfg

amd64.any.clang.linkerexe = "ld.lld"

--passC:"-target x86_64-unknown-elf"
--passC:"-ffreestanding"

--passL:"-nostdlib"
--passL:"-Map=build/kernel.map"
--passL:"-entry KernelMain"
```

We're also passing the `-Map` switch to generate a linker map file. This is useful for showing us the address of each symbol in the output file. Now let's compile the kernel:

```sh-session
$ just kernel

$ file build/kernel.bin
build/kernel.bin: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, not stripped
```

Great! We have an ELF executable kernel image. Let's see what's in it using `llvm-readelf` (I've highlighted the interesting parts):

```sh-session{12,27-30,48-50,56-58}
$ llvm-readelf --headers build/kernel.bin
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              EXEC (Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x20D580
  Start of program headers:          64 (bytes into file)
  Start of section headers:          65648 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         5
  Size of section headers:           64 (bytes)
  Number of section headers:         9
  Section header string table index: 7
There are 9 section headers, starting at offset 0x10070:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .rodata           PROGBITS        0000000000200160 000160 000e90 00 AMS  0   0 16
  [ 2] .text             PROGBITS        0000000000201ff0 000ff0 00b82b 00  AX  0   0 16
  [ 3] .data             PROGBITS        000000000020e820 00c820 0000e0 00  WA  0   0  8
  [ 4] .bss              NOBITS          000000000020e900 00c900 1004b0 00  WA  0   0 16
  [ 5] .comment          PROGBITS        0000000000000000 00c900 00007d 01  MS  0   0  1
  [ 6] .symtab           SYMTAB          0000000000000000 00c980 001b00 18      8 286  8
  [ 7] .shstrtab         STRTAB          0000000000000000 00e480 00003d 00      0   0  1
  [ 8] .strtab           STRTAB          0000000000000000 00e4bd 001bac 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  R (retain), l (large), p (processor specific)

Elf file type is EXEC (Executable file)
Entry point 0x20d580
There are 5 program headers, starting at offset 64

Program Headers:
  Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
  PHDR           0x000040 0x0000000000200040 0x0000000000200040 0x000118 0x000118 R   0x8
  LOAD           0x000000 0x0000000000200000 0x0000000000200000 0x000ff0 0x000ff0 R   0x1000
  LOAD           0x000ff0 0x0000000000201ff0 0x0000000000201ff0 0x00b82b 0x00b82b R E 0x1000
  LOAD           0x00c820 0x000000000020e820 0x000000000020e820 0x0000e0 0x100590 RW  0x1000
  GNU_STACK      0x000000 0x0000000000000000 0x0000000000000000 0x000000 0x000000 RW  0x0

 Section to Segment mapping:
  Segment Sections...
   00     
   01     .rodata 
   02     .text 
   03     .data .bss 
   04     
   None   .comment .symtab .shstrtab .strtab
```

Here's what we can see from the output:

- The entry point is at address `0x20D580`, which is not what we wanted. We wanted the entry point to be at address `0x100000`. We'll fix this later.
- The sections that we're interested in are `.text`, `.rodata`, `.data`, and `.bss`. The `.text` section contains the code, the `.rodata` section contains read-only data, the `.data` section contains initialized data, and the `.bss` section contains uninitialized data. These are the sections that we want to include in the kernel image.
- There are other sections that we're not interested in (`.comment`, `.symtab`, `.shstrtab`, and `.strtab`). These sections are used for debugging information, and we don't need them in the output image. We'll discard these sections later.

Keep in mind that these are the output sections as generated by the linker. The inputs sections from the object files are mapped to these output sections. So in order to write our own linker script, we need to know what sections are generated by the compiler for each object file. Let's take a look at one of the object files that were generated by the compiler:

```sh-session{9,11-12}
$ llvm-objdump --section-headers build/@mmain.nim.c.o

build/@mmain.nim.c.o: file format elf64-x86-64

Sections:
Idx Name            Size     VMA              Type
  0                 00000000 0000000000000000 
  1 .strtab         0000028d 0000000000000000 
  2 .text           0000029b 0000000000000000 TEXT
  3 .rela.text      00000288 0000000000000000 
  4 .rodata.str1.1  0000009f 0000000000000000 DATA
  5 .rodata         00000050 0000000000000000 DATA
  6 .rela.rodata    00000030 0000000000000000 
  7 .comment        0000006a 0000000000000000 
  8 .note.GNU-stack 00000000 0000000000000000 
  9 .llvm_addrsig   00000015 0000000000000000 
 10 .symtab         00000270 0000000000000000 
```

We can see that there are two read-only data sections (`.rodata.str1.1` and `.rodata`). The `rodata.str1.1` section contains string literals, so we'll need to include it in the kernel image. The other sections (other than `.text`) are not relevant to us.

OK, let's create a linker script called `kernel.ld` in the kernel directory, and map the sections that we're interested in to the output sections that we saw earlier, and discard all other sections:

```ld
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text   : { *(.text) }
  .rodata : { *(.rodata*) }
  .data   : { *(.data) }
  .bss    : { *(.bss) }

  /DISCARD/ : { *(*) }
}
```

This tells the linker that the image will be loaded at address `0x100000`, and that the `.text` section (from all object files), the `.data` section, the `.rodata`, and the `.bss` section should be placed in the output file, in this order.

Let's add the linker script to the linker arguments in `nim.cfg`:

```properties
# src/kernel/nim.cfg

--passL:"-T src/kernel/kernel.ld"
```

Let's compile the kernel again, this time using the linker script:

```sh-session
$ just kernel
...
ld.lld: error: discarding .shstrtab section is not allowed
```

Oops, we can't discard the `.shstrtab` section. This section contains the names of the sections, and is required to identify the sections in the output file. Let's add an entry for it in the linker script:

```ld
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text     : { *(.text) }
  .rodata   : { *(.rodata*) }
  .data     : { *(.data) }
  .bss      : { *(.bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

Let's compile the kernel again:

```sh-session{11,26-29}
$ ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              EXEC (Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x10B590
  Start of program headers:          64 (bytes into file)
  Start of section headers:          55240 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         4
  Size of section headers:           64 (bytes)
  Number of section headers:         6
  Section header string table index: 5
There are 6 section headers, starting at offset 0xd7c8:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        0000000000100000 001000 00b82b 00  AX  0   0 16
  [ 2] .rodata           PROGBITS        000000000010b830 00c830 000e90 00 AMS  0   0 16
  [ 3] .data             PROGBITS        000000000010c6c0 00d6c0 0000e0 00  WA  0   0  8
  [ 4] .bss              NOBITS          000000000010c7a0 00d7a0 1004b0 00  WA  0   0 16
  [ 5] .shstrtab         STRTAB          0000000000000000 00d7a0 000024 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  R (retain), l (large), p (processor specific)

Elf file type is EXEC (Executable file)
Entry point 0x10b590
There are 4 program headers, starting at offset 64

Program Headers:
  Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
  LOAD           0x001000 0x0000000000100000 0x0000000000100000 0x00b82b 0x00b82b R E 0x1000
  LOAD           0x00c830 0x000000000010b830 0x000000000010b830 0x000e90 0x000e90 R   0x1000
  LOAD           0x00d6c0 0x000000000010c6c0 0x000000000010c6c0 0x0000e0 0x100590 RW  0x1000
  GNU_STACK      0x000000 0x0000000000000000 0x0000000000000000 0x000000 0x000000 RW  0x0

 Section to Segment mapping:
  Segment Sections...
   00     .text 
   01     .rodata 
   02     .data .bss 
   03     
   None   .shstrtab
```

OK, it looks like the section mapping worked as expected, but the entry point (`KernelMain`) is at `0x10B590` instead of `0x100000`. Let's take a look at the linker map file:

```sh-session
$ head -n 10 build/kernel.map
     VMA              LMA     Size Align Out     In      Symbol
       0                0   100000     1 . = 0x100000
  100000           100000     b82b    16 .text
  100000           100000      9c3    16         /Users/khaledhammouda/src/github.com/khaledh/fusion/build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sexceptions.nim.c.o:(.text)
  100000           100000       3b     1                 rttiDestroy__systemZexceptions_u56
  100040           100040       38     1                 eqtrace___system_u4516
  100080           100080       3b     1                 rttiDestroy__systemZexceptions_u60
  1000c0           1000c0       38     1                 eqtrace___system_u4585
  100100           100100       3b     1                 rttiDestroy__systemZexceptions_u62
  100140           100140       38     1                 eqtrace___system_u4980
```

We can see that the first object file in the output `.text` section is from Nim's standard library module `system/exceptions.nim`. This is because the linker uses the order of the object files in the command line to determine the order in the output image. We don't have much control over the order of the object files in the command line, since Nim generates the command line for us. What we can do is adjust the linker script a bit to tell it to put the kernel object file first.

```ld{6}
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text     : { *kernel*.o(.text) *(.text) }
  .rodata   : { *(.rodata*) }
  .data     : { *(.data) }
  .bss      : { *(.bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

I'm using a wildcard pattern for the kernel object file, since the name is mangled. Let's compile the kernel again and see what the linker map file looks like:

```sh-session
$ head -n 10 build/kernel.map
        VMA              LMA     Size Align Out     In      Symbol
          0                0   100000     1 . = 0x100000
    100000           100000     b822    16 .text
    100000           100000      29b    16         .../fusion/build/@mmain.nim.c.o:(.text)
    100000           100000       c9     1                 KernelMain
    1000d0           1000d0       87     1                 nimFrame
    100160           100160       20     1                 nimErrorFlag
    100180           100180       10     1                 NimMain
    100190           100190       ad     1                 quit__system_u6343
    100240           100240       19     1                 popFrame
```

Great! The kernel object file is now the first object file in the image, and our `KernelMain` proc is exactly at address `0x100000`. This should work, but there's a hidden issue here. The fact that the linker decided to put `KernelMain` at the beginning of the `.text` section is an implementation detail of the linker. If we add more code to the kernel, the linker might decide to put `KernelMain` at a different address. So how do we tell the linker to always put `KernelMain` at the beginning of the `.text` section? Linker scripts work at a section level, so we can't tell the linker to put a specific symbol at a specific address. One thing we can do is use a C compiler flag called `-ffunction-sections`, which tells the compiler to put each function in its own section. The generated section names are in the form `.text.<function name>`. This way we can tell the linker to put the `.text.KernelMain` section at the beginning of the `.text` section. Let's add this flag to the compiler arguments in `nim.cfg`:

```properties
# src/kernel/nim.cfg
...

--passC:"-ffunction-sections"
```

Let's compile the kernel and take a look at the sections in the object file:

```sh-session{10}
$ llvm-objdump --section-headers build/@mmain.nim.c.o

build/@mmain.nim.c.o:   file format elf64-x86-64

Sections:
Idx Name                          Size     VMA              Type
  0                               00000000 0000000000000000 
  1 .strtab                       00000224 0000000000000000 
  2 .text                         00000000 0000000000000000 TEXT
  3 .text.KernelMain              00000070 0000000000000000 TEXT  <-- KernelMain is in its own section
  4 .rela.text.KernelMain         00000090 0000000000000000 
  5 .text.nimFrame                00000087 0000000000000000 TEXT
  6 .rela.text.nimFrame           00000078 0000000000000000 
  7 .text.NimMain                 00000010 0000000000000000 TEXT
  8 .rela.text.NimMain            00000030 0000000000000000 
  9 .text.quit__system_u6343      000000ad 0000000000000000 TEXT
...
```

Looks good. We can now update the linker script to put the `.text.KernelMain` section at the beginning of the `.text` section. We'll follow it with the other function sections from the kernel main object file, and then all other function sections. The reason for this is that we want to keep the code from the kernel main object file together for better cache locality.

```ld{6-9}
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text     : {
    *main*.o(.text.KernelMain)
    *main*.o(.text.*)
    *(.text.*)
  }
  .rodata   : { *(.rodata*) }
  .data     : { *(.data) }
  .bss      : { *(.bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

Let's compile the kernel again and see what the linker map file looks like:

```sh-session{5-6}
$ head -n 10 build/kernel.map
             VMA              LMA     Size Align Out     In      Symbol
               0                0   100000     1 . = 0x100000
          100000           100000     b254    16 .text
          100000           100000       70    16         .../fusion/build/@mmain.nim.c.o:(.text.KernelMain)
          100000           100000       70     1                 KernelMain
          100070           100070       87    16         .../fusion/build/@mmain.nim.c.o:(.text.nimFrame)
          100070           100070       87     1                 nimFrame
          100100           100100       10    16         .../fusion/build/@mmain.nim.c.o:(.text.NimMain)
          100100           100100       10     1                 NimMain
          100110           100110       ad    16         .../fusion/build/@mmain.nim.c.o:(.text.quit__system_u6343)
```

Looks good. Now we're guaranteed that `KernelMain` will always be at the beginning of the `.text` section. The order of other sections is not important to us (unless we want to optimize for cache locality, but let's not pre-optimize for now).

## Building a raw binary

We have an ELF executable kernel image, but we want a raw binary image. Let's add the `--output-format=binary` switch to the linker arguments in `nim.cfg`:

```properties
# src/kernel/nim.cfg

...
--passL:"--oformat=binary"
```

Let's compile the kernel again:

```sh-session
$ just kernel

$ file build/kernel.bin
build/kernel.bin: data
```

Great! We have a raw binary kernel image. But there's one more thing. Let's take a look at the size of the kernel image:

```sh-session
$ wc -c build/kernel.bin
  51104 build/kernel.bin
```

The kernel image is about 51 KB. But remember that we have a 1 MB heap in the `malloc.nim` module. This is not persisted in the image, since it's in the `.bss` section, which is uninitialized data. This poses a problem for the bootloader, since we don't have section metadata in the image. Part of the reason for building a raw binary image is to make it dead simple for the loader to load it into memory without having to worry about initializing sections. One way to solve this problem is to move the `.bss` section into the output `.data` section. This will cause the linker to allocate space for the `.bss` section in the output file. Obviously this will increase the size of the image, but it's a price we're willing to pay to keep the bootloader simple.

Let's modify the linker script to move the `.bss` section into the `.data` section:

```ld{8}
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text   : {
    *kernel*.o(.text.KernelMain)
    *(.text*)
  }
  .rodata   : { *(.rodata*) }
  .data     : { *(.data) *(.bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

Let's compile the kernel again and see what the size of the image is:

```sh-session
$ just kernel

$ wc -c build/kernel.bin
  1100880 build/kernel.bin
```

The image is now about 1.1 MB, which means that the `.bss` section is now included in the image. Now the bootloader will be able to load the image into memory without having to worry about initializing sections.

Let's update our `justfile` to copy the kernel image to the disk image in a place where the bootloader can find it:

```justfile{11-13,15}
# justfile

nimflags := "--os:any"

bootloader:
  nim c {{nimflags}} src/boot/bootx64.nim --out:build/bootx64.efi

kernel:
  nim c {{nimflags}} src/kernel/main.nim --out:build/kernel.bin

run: bootloader kernel
  mkdir -p diskimg/efi/boot
  mkdir -p diskimg/efi/fusion
  cp build/bootx64.efi diskimg/efi/boot/bootx64.efi
  cp build/kernel.bin diskimg/efi/fusion/kernel.bin
  qemu-system-x86_64 \
    -drive if=pflash,format=raw,file=ovmf/OVMF_CODE.fd,readonly=on \
    -drive if=pflash,format=raw,file=ovmf/OVMF_VARS.fd \
    -drive format=raw,file=fat:rw:diskimg \
    -machine q35 \
    -net none
```


In the next section we will continue working on our bootloader. Specifically we will try to use UEFI services to locate the kernel image file, load it into memory address `0x100000`, and jump to it.
