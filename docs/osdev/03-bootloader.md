# UEFI Bootloader

Writing a UEFI bootloader is a complex task. In this section, we'll start by writing a simple UEFI entry point for the bootloader, which we'll build on later.

## Entry point

The UEFI spec defines an application's entry point as:

```c
// UEFI Specification v2.10, Section 4.11
// https://uefi.org/specs/UEFI/2.10/04_EFI_System_Table.html?highlight=efi_system_table#efi-image-entry-point

typedef uint64_t UINTN;
typedef UINTN EFI_STATUS;
typedef void *EFI_HANDLE;
typedef struct { ... } EFI_SYSTEM_TABLE;

typedef EFI_STATUS (*EFI_IMAGE_ENTRY_POINT)(
  IN EFI_HANDLE        ImageHandle,
  IN EFI_SYSTEM_TABLE  *SystemTable
);
```

where `ImageHandle` is a handle to the loaded image, and `SystemTable` is a pointer to the system table. We'll come back to them later. Based on this definition, we'll define our entry point in `src/x86boot.nim`:

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
$ nim c --out:build/x86boot.efi src/x86boot.nim
...

$ file build/x86boot.efi
build/x86boot.efi: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=fd551bd4216ec4e0413961b191d99f0e0775c4f1, for GNU/Linux 4.4.0, not stripped
```

The output binary is an **ELF 64-bit** executable that targets GNU/Linux, which is not what we want. We want a **PE32+** executable as defined by the UEFI spec.

## PE32+ executable

To do this, we'll need to tell the Nim compiler to use the **MinGW-w64** toolchain, and use the `any` target, which only requires a handful of ANSI C library functions (which we'll implement later).

Before we start adding a lot of flags to the Nim compiler, let's create a **nim.cfg** file in the project root to store our compiler flags:

```properties
# nim.cfg

--nimcache:build
--out:build/x86boot.efi
--cpu:amd64
--os:any
--gcc.exe:x86_64-w64-mingw32-gcc
--gcc.linkerexe:x86_64-w64-mingw32-ld
```

```sh-session
$ nim c src/x86boot.nim
...lib/std/typedthreads.nim(51, 10) Error: Threads not implemented for os:any. Please compile with --threads:off.
```

### No threads

Obviously threads are not supported in an environment with no OS support. Let's disable them in **nim.cfg**:

```properties
# nim.cfg

...
--threads:off
```

```sh-session
$ nim c src/x86boot.nim
...lib/system/osalloc.nim(218, 10) Error: Port memory manager to your platform
```

It looks like we need to implement a memory allocator.

### Memory allocator

Since we don't have an OS yet, we need a way to provide memory allocation primitives to the Nim compiler.  The Nim docs say:

> The `-d:useMalloc` option configures Nim to use only the standard C memory manage primitives `malloc()`, `free()`, `realloc()`. If your platform does not provide these functions it should be trivial to provide an implementation for them and link these to your program.

So eventually we'll need to implement these functions. But fortunately, Nim already has a primitive implementation of a bump pointer based heap allocator that we can take advantage of initially. We just need to tell the compiler to use it (here I'm setting the heap size to 1MB):

```properties
# nim.cfg

...
--d:StandaloneHeapSize=1048576
```

```sh-session
$ nim c src/x86boot.nim
...
26196 lines; 0.248s; 30.406MiB peakmem; proj: /home/khaled/src/fusion/src/x86boot.nim; out: /home/khaled/src/fusion/build/x86boot.efi [SuccessX]

$ file build/x86boot.efi
build/x86boot.efi: PE32+ executable (console) x86-64, for MS Windows, 20 sections
```

Great! Now we have a PE32+ executable.

### UEFI subsystem types

Not so fast. It says that the executable type is `console`. This is called the subsystem. The UEFI spec defines [three subsystem types](https://uefi.org/specs/UEFI/2.10/02_Overview.html?highlight=pe32#uefi-images) for EFI images:

```c
// PE32+ Subsystem type for EFI images
#define EFI_IMAGE_SUBSYSTEM_EFI_APPLICATION          10
#define EFI_IMAGE_SUBSYSTEM_EFI_BOOT_SERVICE_DRIVER  11
#define EFI_IMAGE_SUBSYSTEM_EFI_RUNTIME_DRIVER       12
```

In our case, we want to use the `EFI_IMAGE_SUBSYSTEM_EFI_APPLICATION` subsystem type since we're writing a bootloader. To do this, we'll need to tell the linker to use the `--subsystem,10` flag. 

```properties
# nim.cfg

...
--passL:"-Wl,--subsystem,10"
```

```sh-session
$ nim c src/x86boot.nim
...

$ file build/x86boot.efi
build/x86boot.efi: PE32+ executable (EFI application) x86-64, for MS Windows, 20 sections
```

Now we have a PE32+ executable with the correct subsystem type. Let's see how we can load it in QEMU.

## Loading the bootloader

The default BIOS for QEMU is **SeaBIOS**, which is a legacy BIOS. We need to use a UEFI BIOS instead. To download the latest UEFI BIOS for QEMU, we can use the edk2-ovmf package:

```sh-session
$ sudo pacman -S edk2-ovmf
...
```

This installs the UEFI BIOS image to `/usr/share/edk2-ovmf/x64/OVMF_CODE.fd`. We can use this image to boot our bootloader in QEMU:

```sh-session
$ qemu-system-x86_64 \
    -bios /usr/share/edk2-ovmf/x64/OVMF_CODE.fd \
    -drive format=raw,file=build/x86boot.efi
```
