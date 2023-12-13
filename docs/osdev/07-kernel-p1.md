# Kernel - Part 1

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
│       ├── kernel.nim
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
# src/kernel.nim

import debugcon, libc, malloc

proc KernelMain() {.exportc.} =
  debugln "Hello, world!"
  quit()
```

Similar to what we did in the bootloader, we import `libc` and `malloc` since we're compiling for a freestanding environment. Now let's see how we can compile this minimal kernel.

## Linking the kernel

Our goal is to build a raw binary kernel image. We can do this by passing the `--oformat=binary` switch to the linker. But before we do this, we have to understand how the bootloader will load the kernel image into memory and jump to the entry point.

A flat binary image doesn't have metadata to specify an entry point, so the bootloader and the kernel have to agree on a convention. The convention that we'll use is to place the entry point at the beginning of the image. This means that the bootloader will load the kernel image into memory and jump to the beginning of the image. Since the binary image is not relocatable, the kernel has to be linked at a specific address. We'll use the address `0x100000` (1 MiB) for the kernel image. The reason for this particular address is that below this address (specifically the region between 640 KiB to 1 MiB) is reserved for legacy BIOS compatibility (VGA memory, BIOS ROM, etc.) and is not accessible as RAM.

OK, how do we tell the linker to link the kernel at a specific address? We use a linker script. A linker script is a text file that tells the linker how to link the object files into an executable. We'll create a file called `kernel.ld` in the kernel directory:

```ld
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text   : { *(.text) }
  .rodata : { *(.rodata) }
  .data   : { *(.data) }
  .bss    : { *(.bss) }
}
```

This tells the linker that the image will be loaded at address `0x100000`, and that the `.text` section (from all object files), the `.data` section, the `.rodata`, and the `.bss` section should be placed in the output file, in this order. The `.text` section contains the code, the `.rodata` section contains read-only data, the `.data` section contains initialized data, and the `.bss` section contains uninitialized data. We may need to adjust these section names depending on what the compiler generates for each object file.

The `lld-link` linker that we've been using so far (to generate a PE image) doesn't seem to support linker scripts (at least I couldn't find a way to do it). That's OK; we don't the PE format anymore, it was only needed for the UEFI bootloader. So for the kernel, we'll switch to using the `ld.lld` linker, which is the LLVM linker for Unix systems. The most widely used executable format on Unix systems is ELF, so we'll use that as well. We'll come back later to building a raw binary image.

Let's add some arguments in `src/kernel/nim.cfg` to use `ld.lld` and generate an ELF executable:

```properties
# src/kernel/nim.cfg

--passC:"-target x86_64-unknown-elf"
--passC:"-ffreestanding"

--passL:"-target x86_64-unknown-elf"
--passL:"-nostdlib"
--passL:"-T src/kernel/kernel.ld"
--passL:"-Map=build/kernel.map"
```

We're also passing the `-Map` switch to generate a linker map file. This is useful for showing us the address of each symbol in the output file.

Now let's compile the kernel:

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.elf

$ file build/kernel.elf
build/kernel.elf: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, stripped
```

Great! We have an ELF executable kernel image. Let's see what's in it:

```sh-session
$ llvm-objdump --section-headers build/kernel.elf

build/kernel.elf:       file format elf64-x86-64

Sections:
Idx Name          Size     VMA              Type
  0               00000000 0000000000000000 
  1 .text         0000b5fb 0000000000100000 TEXT
  2 .data         002013f0 000000000010b600 DATA
  3 .shstrtab     00000017 0000000000000000
```

We can see that the `.text` section starts at address `0x100000`, which is what we wanted. The `.data` section follows the `.text` section, and the `.shstrtab` section is at the end. The `.shstrtab` section contains the names of the sections.

But wait, where are the `.rodata` and `.bss` sections? This is where we need to inspect the object files that make up the kernel image. Let's take a look at the object files that were generated by the compiler:

```sh-session
$ ls -1 build/*.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@sstd@sassertions.nim.c.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@sstd@sprivate@sdigitsutils.nim.c.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@sstd@swidestrs.nim.c.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sdollars.nim.c.o
build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sexceptions.nim.c.o
build/@m..@scommon@slibc.nim.c.o
build/@m..@scommon@smalloc.nim.c.o
build/@m..@scommon@suefi.nim.c.o
build/@mdebugcon.nim.c.o
build/@mkernel.nim.c.o
```

The compiler generated object files for the standard library modules that we imported, and for modules that we defined. The names are mangled to avoid name collisions. Let's inspect the object file for the `kernel` module:

```sh-session
$ llvm-objdump --section-headers build/@mkernel.nim.c.o
build/@mkernel.nim.c.o: file format elf64-x86-64

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

We can see that there are one text section (`.text`), two data sections (`.rodata.str1.1` and `.rodata`). Let's take a look at another object file:

```sh-session
$ llvm-objdump --section-headers build/@m..@scommon@slibc.nim.c.o

build/@m..@scommon@slibc.nim.c.o:       file format elf64-x86-64

Sections:
Idx Name            Size     VMA              Type
  0                 00000000 0000000000000000 
  1 .strtab         00000210 0000000000000000 
  2 .text           00000ca6 0000000000000000 TEXT
  3 .rela.text      000005b8 0000000000000000 
  4 .rodata.str1.1  0000019a 0000000000000000 DATA
  5 .rodata         00000020 0000000000000000 DATA
  6 .rela.rodata    00000018 0000000000000000 
  7 .bss            00000010 0000000000000000 BSS
  8 .comment        0000006a 0000000000000000 
  9 .note.GNU-stack 00000000 0000000000000000 
 10 .llvm_addrsig   00000010 0000000000000000 
 11 .symtab         000002b8 0000000000000000
```

We see one extra section `.bss` here. This is the uninitialized data section, which makes sense, since the `malloc.nim` module defines an uninitalized heap that we use for memory allocation. All other sections have similar sections. So we need to adjust our linker script to account for these sections:

```ld
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text   : { *(.text) }
  .rodata : { *(.rodata*) }
  .data   : { *(.data) }
  .bss    : { *(.bss) }
}
```

The only change we made is to use `*(.rodata*)` instead of `*(.rodata)`, which should include `.rodata` and `.rodata.str1.1`. Let's compile the kernel again:

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.elf

$ llvm-objdump --section-headers build/kernel.elf
build/kernel.elf:       file format elf64-x86-64

Sections:
Idx Name          Size     VMA              Type
  0               00000000 0000000000000000 
  1 .text         0000b822 0000000000100000 TEXT
  2 .rodata       00000e90 000000000010b830 DATA
  3 .data         000000e0 000000000010c6c0 DATA
  4 .bss          001004b0 000000000010c7a0 BSS
  5 .comment      0000007d 0000000000000000 
  6 .symtab       00001b18 0000000000000000 
  7 .shstrtab     0000003d 0000000000000000 
  8 .strtab       00001bb9 0000000000000000 
```

We can see that the `.rodata` and `.bss` sections are now included. But there's also other sections that we didn't see before. These are sections that the compiler generated for debugging information. We don't need these sections in the kernel image, so let's remove them from the linker script:

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

The `/DISCARD/` section tells the linker to discard all sections that match the pattern `*`. Let's compile the kernel again:

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.elf
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

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.elf

$ llvm-objdump --section-headers build/kernel.elf

build/kernel.elf:       file format elf64-x86-64

Sections:
Idx Name          Size     VMA              Type
  0               00000000 0000000000000000 
  1 .text         0000b822 0000000000100000 TEXT
  2 .rodata       00000e90 000000000010b830 DATA
  3 .data         000000e0 000000000010c6c0 DATA
  4 .bss          001004b0 000000000010c7a0 BSS
  5 .shstrtab     00000024 0000000000000000
```

Great! We have a kernel image that contains only the sections that we need. Let's see what the linker map file looks like:

```sh-session
$ head -n 20 build/kernel.map
      VMA              LMA     Size Align Out     In      Symbol
        0                0   100000     1 . = 0x100000
   100000           100000     b82b    16 .text
   100000           100000      9c3    16         /Users/.../fusion/build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sexceptions.nim.c.o:(.text)
   100000           100000       3b     1                 rttiDestroy__systemZexceptions_u56
   100040           100040       38     1                 eqtrace___system_u4516
   100080           100080       3b     1                 rttiDestroy__systemZexceptions_u60
   1000c0           1000c0       38     1                 eqtrace___system_u4585
   100100           100100       3b     1                 rttiDestroy__systemZexceptions_u62
   100140           100140       38     1                 eqtrace___system_u4980
```

The `.text` section starts at `0x100000`, so that's good. However, the first object file linked at this address is Nim's standard library module `system/exceptions.nim`. This is not good. We want our kernel object file to be the first, as this will be the entry point to which the bootloader will transfer control.

The order of the object files in the image is based on the order of the object files in the linker command line, which we don't have much control over (Nim generates the command line for us). What we can do is adjust the linker script a bit to tell it to put the kernel object file first.

```ld
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0x100000;
  .text     : {
    *kernel*.o(.text)
    *(.text)
  }
  .rodata   : { *(.rodata*) }
  .data     : { *(.data) }
  .bss      : { *(.bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

I'm using a wildcard pattern for the kernel object file, since the name is mangled. Let's compile the kernel again and see what the linker map file looks like:

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.elf

$ head -n 10 build/kernel.map
      VMA              LMA     Size Align Out     In      Symbol
        0                0   100000     1 . = 0x100000
   100000           100000     b822    16 .text
   100000           100000      29b    16         /Users/.../fusion/build/@mkernel.nim.c.o:(   text)
   100000           100000       c9     1                 KernelMain
   1000d0           1000d0       87     1                 nimFrame
   100160           100160       20     1                 nimErrorFlag
   100180           100180       10     1                 NimMain
   100190           100190       ad     1                 quit__system_u6343
   100240           100240       19     1                 popFrame
```

Great! The kernel object file is now the first object file in the image, and our `KernelMain` proc is exactly at address `0x100000`.

## Building a raw binary

We have an ELF executable kernel image, but we want a raw binary image. Let's add the `--output-format=binary` switch to the linker arguments in `nim.cfg`:

```properties
# src/kernel/nim.cfg

...
--passL:"--oformat=binary"
```

Let's compile the kernel again:

```sh-session
$ nim c --os:any src/kernel/kernel.nim --out:build/kernel.bin

$ file build/kernel.bin
build/kernel.bin: data
```

Great! We have a raw binary kernel image that we can copy to the disk image. In the next section we will continue working on our bootloader. Specifically we will try to use UEFI services to locate the kernel image file, load it into memory address `0x100000`, and jump to it.
