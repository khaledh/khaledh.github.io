# Targeting UEFI (Part 1)

Traditionally, booting an operating system on x86/x86\_64 hardware has been done using the
BIOS. The BIOS has been considered legacy for a long time, and has been replaced by UEFI
(Unified Extensible Firmware Interface) on most modern hardware. We no longer have to
write a boot sector in assembly and rely on BIOS interrupts to load the OS. In this
section we will focus on cross-compiling to UEFI (we'll get to the actual booting part
later).

Since there is no OS to target yet, we'll need to cross-compile to a **freestanding**
environment (as opposed to an OS hosted environment), where only a subset of the C
standard library and runtime is available. That means we can't use features from the
standard library that rely on OS support like memory allocation, threads, IO, etc.

::: tip Goal Build a minimal UEFI executable using Nim. The executable should assume a
freestanding environment and does nothing but return 0 from the entry point.
:::

## Building a PE32+ executable

The first hurdle we have to overcome is that the UEFI firmware expects a PE32+
executable (Portable Executable with 64-bit extension to the standard PE32 format), which
is an executable format used by Windows. It also expects the executable to follow the
Windows ABI x64 calling convention. But since we're developing on Linux, we'll need a way
to cross-compile our bootloader to this format.

Let's forget about Nim for a moment. Can we cross-compile a simple C program to a
freestanding PE32+ executable on Linux? This is why we installed `clang` earlier, which
supports multiple targets. The target we're interested in is `x86_64-unknown-windows` (the
`unknown` part is for the vendor, which is not important in our case). We also need to
tell the compiler that we don't have a standard library by passing the `-ffreestanding`
flag:

```c
// main.c

int main() {
    return 0;
}
```

```sh-session
$ clang -c \
    -target x86_64-unknown-windows \
    -ffreestanding \
    -o build/main.o \
    main.c

$ file build/main.o
build/main.o: Intel amd64 COFF object file, not stripped, 6 sections, symbol offset=0x143, 16 symbols, created Thu Nov 30 02:47:57 2023, 1st section name ".text"
```

We have a COFF object file, which is what PE32+ executables are based on. Now let's link
it by telling `clang` to use the `lld-link` linker (which is the `lld` linker flavor that
targets Windows):

```sh-session
$ clang \
    -target x86_64-unknown-windows \
    -fuse-ld=lld-link \
    -o build/main.exe \
    build/main.o
lld-link: error: could not open 'libcmt.lib': No such file or directory
lld-link: error: could not open 'oldnames.lib': No such file or directory
```

The linker is trying to statically link `libcmt.lib`, the native Windows CRT startup
library, and `oldnames.lib`, a compatibility library for redirecting old function names to
new ones. We're not going to rely on these default libraries, so we can tell the linker to
exclude them by passing the `-nostdlib` flag:

```sh-session{4}
$ clang \
    -target x86_64-unknown-windows \
    -fuse-ld=lld-link \
    -nostdlib \
    -o build/main.exe \
    build/main.o
lld-link: error: <root>: undefined symbol: mainCRTStartup
```

The linker is unable to find the C runtime entry point, `mainCRTStartup`, which makes
sense because we're not linking the startup library. We can tell the linker to use our
`main` function as the entry point by passing the `-entry:main` flag:

```sh-session{5}
$ clang \
    -target x86_64-unknown-windows \
    -fuse-ld=lld-link \
    -nostdlib \
    -Wl,-entry:main \
    -o build/main.exe \
    build/main.o

$ file build/main.exe
build/main.exe: PE32+ executable (console) x86-64, for MS Windows
```

Great! We have a PE32+ executable. But notice that it says `(console)`. This means that
the executable is a console application, which cannot run on UEFI. We need to tell the
linker to create a UEFI application instead by passing the `-subsystem:efi_application`
flag:

```sh-session{6}
$ clang \
    -target x86_64-unknown-windows \
    -fuse-ld=lld-link \
    -nostdlib \
    -Wl,-entry:main \
    -Wl,-subsystem:efi_application \
    -o build/main.exe \
    build/main.o

$ file build/main.exe
build/main.exe: PE32+ executable (EFI application) x86-64, for MS Windows
```

Now we have a true UEFI application.

## Cross-compiling Nim to PE32+

Let's try to do the same thing with Nim. We'll port the C program to Nim:

```nim
# main.nim

proc main(): int {.exportc.} =
    return 0
```

The `{.exportc.}` pragma tells the Nim compiler to export the function name as is, without
any mangling. We do this because we need to pass the entry point name to the linker, and
we don't want the compiler to mangle it.

Before we port this to Nim, we need to understand that Nim itself supports multiple
targets. There are three arguments that influence the compilation/linking to a specific
target:

- `--cpu`(architecture), which defaults to the host architecture (in my case this is
  `amd64`, i.e. x86\_64)
- `--os`(operating system), which defaults to the host operating system (in my case this
  is `linux`)
- `--cc`(backend compiler), which defaults to `gcc` (on Windows it relies on MinGW, which
  is a port of GCC to Windows)

Nim does support cross-compiling to Windows using the `-d:mingw` flag. However, while the
executable we want is a Windows executable format, the target OS is not Windows, but UEFI.
Nim doesn't have a target OS for UEFI, so we'll need to use the `--os:any` flag to tell
the compiler to not use any OS-specific code (it only expects a handful of ANSI C library
functions to be available).

So, to cross-compile to UEFI, we need to set these three flags to: `--cpu:amd64`,
`--os:any`, and `--cc:clang`. We also pass the `clang` flags we used earlier to the
compiler and linker using the `--passc` and `--passl` flags respectively.

```sh-session
$ nim c \
    --nimcache:build \
    --cpu:amd64 \
    --os:any \
    --cc:clang \
    --passc:"-target x86_64-unknown-windows" \
    --passc:"-ffreestanding" \
    --passl:"-fuse-ld=lld-link" \
    --passl:"-nostdlib" \
    --passl:"-Wl,-entry:main" \
    --passl:"-Wl,-subsystem:efi_application" \
    --out:build/main.exe \
    main.nim
.../lib/system/osalloc.nim(218, 10) Error: Port memory manager to your platform
```

The compiler is complaining that it doesn't know how to allocate memory on this platform.
This makes sense because we're not targeting any OS. Since we don't have an OS yet, we
need a way to provide memory allocation primitives to the Nim compiler. The Nim docs say:

> The `-d:useMalloc` option configures Nim to use only the standard C memory manage
primitives `malloc()`, `free()`, `realloc()`. If your platform does not provide these
functions it should be trivial to provide an implementation for them and link these to
your program.

OK, at least we have a way to provide memory allocation primitives to Nim, instead of
assuming they're provided by an existing OS (e.g. `mmap` on Linux or `VirtualAlloc` on
Windows). Since we don't have an OS yet, let's implement a simple bump allocator backed by
a fixed-size buffer. To keep things simple, we will not worry about freeing memory for
now (we'll get to that later when we implement a proper memory manager).

```nim
# malloc.nim

{.used.}

var
  heap*: array[1*1024*1024, byte] # 1 MiB heap
  heapBumpPtr*: int = cast[int](addr heap)
  heapMaxPtr*: int = cast[int](addr heap) + heap.high

proc malloc*(size: csize_t): pointer {.exportc.} =
  if heapBumpPtr + size.int > heapMaxPtr:
    return nil

  result = cast[pointer](heapBumpPtr)
  inc heapBumpPtr, size.int

proc calloc*(num: csize_t, size: csize_t): pointer {.exportc.} =
  result = malloc(size * num)

proc realloc*(p: pointer, new_size: csize_t): pointer {.exportc.} =
  result = malloc(new_size)
  copyMem(result, p, new_size)
  free(p)

proc free*(p: pointer) {.exportc.} =
  discard
```

Notice that I added the `{.used.}` pragma at the top of the file. This tells the compiler
to consider the module as used, even if we don't call any of its procs directly.
Otherwise, the compiler will consider it dead code and will eliminate it from the output.

For Nim to actually know about this module, we need to import it in our main module:

```nim
# main.nim

import malloc
...
```

Now let's pass the `-d:useMalloc` flag to the compiler and try to compile again:

```sh-session{12}
$ nim c \
    --nimcache:build \
    --cpu:amd64 \
    --os:any \
    --cc:clang \
    --passc:"-target x86_64-unknown-windows" \
    --passc:"-ffreestanding" \
    --passl:"-fuse-ld=lld-link" \
    --passl:"-nostdlib" \
    --passl:"-Wl,-entry:main" \
    --passl:"-Wl,-subsystem:efi_application" \
    -d:useMalloc \
    --out:build/main.exe \
    main.nim
...
/home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@sstd@sprivate@sdigitsutils.nim.c:8:10: fatal error: 'string.h' file not found
    8 | #include <string.h>
      |          ^~~~~~~~~~
/home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c:8:10: fatal error: 'setjmp.h' file not found
    8 | #include <setjmp.h>
      |          ^~~~~~~~~~
/home/khaled/.cache/nim/main_d/@mmain.nim.c:113:5: error: conflicting types for 'main'
  113 | int main(int argc, char** args, char** env) {
      |     ^
/home/khaled/.cache/nim/main_d/@mmain.nim.c:65:29: note: previous definition is here
   65 | N_LIB_PRIVATE N_NIMCALL(NI, main)(void) {
      |
```

We're getting a different error, which means that Nim is happy with our memory allocation
primitives.

At first glance, it looks like we're missing some C headers. It turns out that `clang`
needs to be told where to find the system headers. In my case, the headers are located in
`/usr/include` (on macOS, the system headers are located at
`` `xcrun --show-sdk-path`/usr/include ``), so we'll pass that to the compiler using the
`-I` flag:

```sh-session{8}
$ nim c \
    --nimcache:build \
    --cpu:amd64 \
    --os:any \
    --cc:clang \
    --passc:"-target x86_64-unknown-windows" \
    --passc:"-ffreestanding" \
    --passc:"-I/usr/include" \
    --passl:"-target x86_64-unknown-windows" \
    --passl:"-fuse-ld=lld-link" \
    --passl:"-nostdlib" \
    --passl:"-Wl,-entry:main" \
    --passl:"-Wl,-subsystem:efi_application" \
    -d:useMalloc \
    --out:build/main.exe \
    main.nim
...
/home/khaled/.cache/nim/main_d/@mmain.nim.c:113:5: error: conflicting types for 'main'
  113 | int main(int argc, char** args, char** env) {
      |     ^
/home/khaled/.cache/nim/main_d/@mmain.nim.c:65:29: note: previous definition is here
   65 | N_LIB_PRIVATE N_NIMCALL(NI, main)(void) {
      |
```

> **Note**: On macOS, the system headers are located at
`` `xcrun --show-sdk-path`/usr/include ``, so you'll need to replace `/usr/include` with
that path in the `--passc` flag. Also, you'll need to pass
`--passc:"-fgnuc-version=4.2.1"` (which defines `__GNUC__`) to avoid any macOS-specific
marcros and stick with the GNU C ones.

In order to understand what's going on here it's important to note that, unlike C, Nim
programs are not required to have a `main` function. You can have a file with code at the
top level and it will be executed when the program starts. When we defined a `main` proc (
which, to Nim, is just another proc that has no special meaning), we caused a conflict
with the `main` function that the Nim compiler generates by default. Since we're not going
to rely on the C library startup code, we need to take over the startup process ourselves.
We can tell Nim to not generate its own `main` function by passing the `--noMain:on` flag.

However, by doing so, we lose initialization of global variables done by the automatically
generated `NimMain` function. We can get it back by forward importing `NimMain` and
calling it from our `main` proc:

```nim
# main.nim

proc NimMain() {.importc.}

proc main(): int {.exportc.} =
    NimMain()
    return 0
```

Let's try to compile again with the `--noMain:on` flag:

```sh-session{15}
$ nim c \
    --nimcache:build \
    --cpu:amd64 \
    --os:any \
    --cc:clang \
    --passc:"-target x86_64-unknown-windows" \
    --passc:"-ffreestanding" \
    --passc:"-I/usr/include" \
    --passl:"-target x86_64-unknown-windows" \
    --passl:"-fuse-ld=lld-link" \
    --passl:"-nostdlib" \
    --passl:"-Wl,-entry:main" \
    --passl:"-Wl,-subsystem:efi_application" \
    -d:useMalloc \
    --noMain:on \
    --out:build/main.exe \
    main.nim
...
lld-link: error: undefined symbol: memcpy
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@sstd@sprivate@sdigitsutils.nim.c.o:(nimCopyMem)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(nimCopyMem)

lld-link: error: undefined symbol: stderr
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(raiseOutOfMem__system_u5532)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(writeToStdErr__system_u3828)

lld-link: error: undefined symbol: exit
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(raiseOutOfMem__system_u5532)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(callDepthLimitReached__system_u4467)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(signalHandler)
>>> referenced 1 more times

lld-link: error: undefined symbol: fwrite
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(rawWrite)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(rawWriteString)

lld-link: error: undefined symbol: fflush
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(rawWrite)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(rawWriteString)

lld-link: error: undefined symbol: strlen
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(nimCStrLen)

lld-link: error: undefined symbol: signal
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(registerSignalHandler__system_u4487)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(registerSignalHandler__system_u4487)
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(registerSignalHandler__system_u4487)
>>> referenced 2 more times

lld-link: error: undefined symbol: memset
>>> referenced by /home/khaled/.cache/nim/main_d/@m..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem.nim.c.o:(nimSetMem__systemZmemory_u7)
```

OK, the linker is complaining that it can't find some C functions. This is because we're
targeting `--os:any`, which expects a handful of ANSI C library functions to be available
for Nim to use:

- `memset` and `memcpy` for some memory operations
- `strlen` for string length
- `fwrite` and `fflush` for writing to a file descriptor
- `stderr` for printing to standard error (not a function, but a global variable)
- `signal` for signal handlers
- `exit` for exiting the program

Since our OS won't be a POSIX system, we can disable signals by passing the
`-d:noSignalHandler` flag. For the rest of the functions, we'll need to implement them
ourselves. Also, Nim includes implementation of some memory functions, which we can
leverage by passing the `-d:nimNoLibc` flag.

Before we go any further, let's move the compiler flags to a **nim.cfg** file in the
project root, so we don't have to pass them every time we compile:

```properties
# nim.cfg
--nimcache:build
--noMain:on
-d:useMalloc
-d:nimNoLibc
-d:noSignalHandler
--cpu:amd64
--os:any
--cc:clang
--passc:"-target x86_64-unknown-windows"
--passc:"-ffreestanding"
--passc:"-I/usr/include"
--passl:"-target x86_64-unknown-windows"
--passl:"-fuse-ld=lld-link"
--passl:"-nostdlib"
--passl:"-Wl,-entry:main"
--passl:"-Wl,-subsystem:efi_application"
```

```sh-session
$ nim c main.nim --out:build/main.exe
.../lib/std/typedthreads.nim(51, 10) Error: Threads not implemented for os:any. Please compile with --threads:off.
```

This seems weird. The `--os:any` target should disable threads by default, which we know
is true because we didn't get this error when we passed the flags on the command line. It
turns out that Nim processes its default `nim.cfg` file (which turns off threads for
`os:any`) _before_ the project `nim.cfg` file (which defines `--os:any`). So by the time
the project `nim.cfg` file is processed, threads are already enabled. We can technically
disable threads in the project `nim.cfg` file using `--threads:off`, but since the default
`nim.cfg` makes a lot of decisions based on the `os` flag, we'll need to pass this flag
explicitly every time we compile.

```sh-session
$ nim c --os:any main.nim --out:build/main.exe
...
lld-link: error: undefined symbol: stderr
lld-link: error: undefined symbol: exit
lld-link: error: undefined symbol: fwrite
lld-link: error: undefined symbol: fflush
...
```

We get less linker errors now, thanks to the `--d:nimNoLibc` and `--d:noSignalHandler`
flags. We still, however, need to implement `stderr`, `fwrite`, `fflush`, and `exit`.

This section is already too long, so we'll continue in the next section, where we'll
implement the missing C functions.
