# UEFI Bootloader

Writing a UEFI bootloader is a complex task. In this section, we'll start by writing a simple UEFI entry point for the bootloader, which we'll build on later. The UEFI spec defines an application's entry point as:

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

The output binary is an **ELF 64-bit** executable that targets GNU/Linux, which is not what we want. We want a **PE32+** executable that is freestanding (i.e. no OS support). To do this, we'll need to tell the Nim compiler to use the **MinGW-w64** toolchain, and use the `any` target, which only requires a handful of ANSI C library functions (which we'll implement later).

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
```

---
<CommentService />
