# Targeting UEFI - Part 2

In the previous section, we were faced with the need to implement a number of ANSI C library functions. Let's implement them now.

## C library functions

### `fwrite`

The `fwrite` function writes `count` elements of data, each `size` bytes long, to the stream pointed to by `stream`, obtaining them from the location given by `ptr`. It returns the number of elements successfully written.

```c
size_t fwrite(const void *ptr, size_t size, size_t count, FILE *stream);
```

The `FILE *` struct pointer is already defined in Nim as `File`, so we can use that directly. `const void *`, however, has no equivalent type in Nim, so we'll define it by importing the C equivalent. Since we don't have something to write to yet, we'll just create an dummy implementation:

```nim
# src/libc.nim

type
  const_pointer {.importc: "const void *".} = pointer

proc fwrite*(ptr: const_pointer, size: csize_t, count: csize_t, stream: File):
    csize_t {.exportc.} =
  return count
```

### `fflush`

The `fflush` function flushes the stream pointed to by `stream`. It returns `0` on success, or `EOF` on error.

```c
int fflush(FILE *stream);
```

Again, we'll just create a dummy implementation for now:

```nim
# src/libc.nim

proc fflush*(stream: File): cint {.exportc.} =
  return 0.cint
```

### `stderr`

The `stderr` global variable is a pointer to a `FILE` struct that represents the standard error stream.

```c
FILE *stderr;
```

We can define it in Nim as a variable of type `File`, which will be initialized to `nil` by default:

```nim
# src/libc.nim

var stderr* {.exportc.}: File
```

### `exit`

The `exit` function causes normal process termination and the value of `status` is returned to the parent.

```c
void exit(int status);
```

Since we don't have an OS yet, there is nothing to return to, so we'll just halt the CPU using inline assembly:

```nim
# src/libc.nim

proc exit*(status: cint) {.exportc, asmNoStackFrame.} =
  asm """
  .loop:
    cli
    hlt
    jmp .loop
  """
```

This clears the interrupt flag, then halts the CPU. The CPU can still be interrupted by NMI, SMI, or INIT interrupts, so that's why we have a loop to keep halting the CPU if this happens. The `asmNoStackFrame` pragma tells the compiler to not create a stack frame for this procedure, since it's pure assembly that we never return from.

## Linking the C library

Now that we have implemented the missing library functions and exported them, we can link them into our executable. Let's import the `libc` module in `main.nim`:

```nim
# src/main.nim

import libc
...
```

Since we don't directly use the `libc` module functions in `main.nim`, we'll get a warning that the module is unused. We can tell the compiler that the library will be used by adding the `{.used.}` pragma at the top of the `libc.nim` module.

Here's the complete `libc.nim` module:

```nim
# src/libc.nim

{.used.}

type
  const_pointer {.importc: "const void *".} = pointer

proc fwrite*(buf: const_pointer, size: csize_t, count: csize_t, stream: File): csize_t {.exportc.} =
  return 0.csize_t

proc fflush*(stream: File): cint {.exportc.} =
  return 0.cint

var stderr* {.exportc.}: File

proc exit*(status: cint) {.exportc, asmNoStackFrame.} =
  asm """
  .loop:
    cli
    hlt
    jmp .loop
  """
```

Let's compile and link our code:

```sh-session
$ nim c --os:any src/main.nim

$ file build/main.exe
build/main.exe: PE32+ executable (EFI application) x86-64, for MS Windows, 4 sections
```

Great! We were able to compile and link our Nim code into a PE32+ executable that targets UEFI with no OS support. Now we're in a good shape to start implementing our bootloader.
