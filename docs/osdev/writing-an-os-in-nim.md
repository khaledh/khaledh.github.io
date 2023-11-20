# Writing an OS in Nim

## Introduction

I decided to document my journey of writing an OS in Nim. Why Nim? It's one of the few languages
that allow low-level systems programming with deterministic memory management (garbage collector is optional) with destructors and move semantics. It's also statically typed, which provides greater type safety. It also supports inline assembly, which is a must for OS development.  Other options include C, C++, Rust, and Zig. They're great languages, but I chose Nim for its simplicity, elegance, and performance.

Let's get started!

## Setting up the environment

First, we need to install the **Nim compiler**. An easy way to install Nim is through the **choosenim** installer, so let's install that first:

```sh-session
$ curl https://nim-lang.org/choosenim/init.sh -sSf | sh
```

Then, we can install the latest stable version of Nim:

```sh-session
$ choosenim stable
Downloading Nim 2.0.0 from nim-lang.org
...

$ nim -v
Nim Compiler Version 2.0.0 [Linux: amd64]
...
```

Now that we have Nim installed, we need to install the cross-compiler for our target platform. Since we'll be targeting **UEFI** as our boot environment, we'll need a compiler/linker that generates **PE32+** binaries. The easiest way to get this is to use the **MinGW-w64** toolchain. I'm on Arch Linux, so I can install it with:

```sh-session
$ sudo pacman -S mingw-w64-gcc
...

$ x86_64-w64-mingw32-gcc -dumpversion
12.2.0
```

Next, let's install **QEMU** so that we can test our OS:

```sh-session
$ sudo pacman -S qemu-desktop
...

$ qemu-system-x86_64 --version
QEMU emulator version 8.1.2
...
```

Finally, we need to install **just** so that we can build our OS:

```sh-session
$ sudo pacman -S just
...

$ just --version
just 1.16.0
```

## Creating the project

Now that we have our environment set up, we can create our project. We'll start by creating a new directory for our project:

```sh-session
$ mkdir fusion && cd fusion
```

Next, we'll create a new **nimble** project with binary package type:

```sh-session
$ nimble init
...
    Prompt: Package type?
        ... Library - provides functionality for other packages.
        ... Binary  - produces an executable for the end-user.
        ... Hybrid  - combination of library and binary
        ... For more information see https://goo.gl/cm2RX5
     Select Cycle with 'Tab', 'Enter' when done
    Answer: binary
...
```

Let's also create a `build` directory for our build artifacts and add it to `.gitignore`:

```sh-session
$ mkdir build
$ echo build >> .gitignore
```

## Writing the bootloader

Now we'll write a simple UEFI entry point for the bootloader. UEFI applications entry point are defined as:

```c
// UEFI Specification v2.10, Section 4.11
// https://uefi.org/specs/UEFI/2.10/04_EFI_System_Table.html?highlight=efi_system_table#efi-image-entry-point

typedef EFI_STATUS (*EFI_IMAGE_ENTRY_POINT)(
  IN EFI_HANDLE        ImageHandle,
  IN EFI_SYSTEM_TABLE  *SystemTable
);

// where:

typedef uint64_t UINTN;
typedef UINTN EFI_STATUS;
typedef void *EFI_HANDLE;
typedef struct { ... } EFI_SYSTEM_TABLE;

```

where `ImageHandle` is a handle to the loaded image, and `SystemTable` is a pointer to the system table. We'll come back to them later. Based on this definition, we'll define our entry point in **src/x86boot.nim**:

```nim
# src/x86boot.nim

type
  EfiStatus = uint
  EfiHandle = pointer
  EFiSystemTable = object  # to be defined later

proc efiMain(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  return 0
```

Let's compile this and see check the output:

```sh-session
$ nim c --outdir:build src/x86boot.nim
...
$ file build/x86boot.exe
build/x86boot: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked,
interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=fd551bd4216ec4e0413961b191d99f0e0775c4f1,
for GNU/Linux 4.4.0, not stripped
```

The output binary is an **ELF 64-bit** executable that targets GNU/Linux, which is not what we want. We want a **PE32+** executable that is freestanding (i.e. no OS support). To do this, we'll need to tell the Nim compiler to use the **MinGW-w64** toolchain, and use the `standalone` target.

```sh-session
$ nim c \
    --outdir:build \
    --cpu:amd64 \
    --os:standalone \
    --gcc.exe:x86_64-w64-mingw32-gcc \
    --gcc.linkerexe:x86_64-w64-mingw32-ld \
    src/x86boot.nim
.../lib/system/fatal.nim(17, 11) Error: cannot open file: /home/khaled/src/fusion/src/panicoverride
```



And we can run our OS in QEMU:

```sh-session
$ qemu-system-x86_64 \
    -bios /usr/share/ovmf/x64/OVMF_CODE.fd \
    -drive format=raw,file=fusion.efi
```

## Conclusion

We've successfully created a simple UEFI application in Nim! In the next post, we'll start writing our kernel.
