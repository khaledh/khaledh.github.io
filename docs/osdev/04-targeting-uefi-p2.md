# Targeting UEFI - Part 2

In the previous section, we were faced with the need to implement a number of ANSI C library functions. Let's implement them now.

## C library functions

### `memset`

The `memset` function sets the first `n` bytes of the memory area pointed to by `s` to the specified value `c`. It returns `s`.

```c
void *memset(void *s, int c, size_t n);
```

Let's start by creating a new file in `src` called `memset.nim`, and implement the function:

```nim
# src/libc.nim

proc memset*(p: pointer, value: cint, size: csize_t): pointer {.exportc.} =
  let pp = cast[ptr UncheckedArray[byte]](p)
  let v = cast[byte](value)
  for i in 0 ..< size:
    pp[i] = v
  return p
```

We first cast the pointer to an `UncheckedArray[byte]`, which allows us to index into the pointer. Then, we cast the value to a `byte`, which allows us to assign it to the pointer. The rest is just a simple loop.

### `memcpy`

The `memcpy` function copies `n` bytes from memory area `src` to memory area `dest`. It returns `dest`.

```c
void *memcpy(void *dest, const void *src, size_t n);
```

Here we have a const pointer, which Nim doesn't have an equivalent for. What we can do is declare a new type called `constPointer` which uses the `{.importc.}` pragma to bring in the `const` qualifier:

```nim
# src/libc.nim

type
  constPointer {.importc: "const void *".} = pointer

proc memcpy*(dest: pointer, src: constPointer, size: csize_t): pointer {.exportc.} =
  let pdest = cast[ptr UncheckedArray[byte]](dest)
  let psrc = cast[ptr UncheckedArray[byte]](src)
  for i in 0 ..< size:
    pdest[i] = psrc[i]
  return dest
```

We could improve the performance by copying 8 bytes at a time (using 64-bit values), but I wanted to keep it simple.

### `strlen`

The `strlen` function calculates the length of the string pointed to by `s`, excluding the terminating null byte (`\0`). It returns the number of bytes in the string.

```c
size_t strlen(const char *s);
```

Here we have a const pointer to a `char`, so we can use the same trick as before to create a `constCString` type:

```nim
# src/libc.nim

type
  constCString {.importc: "const char *".} = pointer

proc strlen*(str: constCString): csize_t {.exportc.} =
  let s = cast[ptr UncheckedArray[byte]](str)
  var len = 0
  while s[len] != 0:
    inc len
  result = len.csize_t
```

### `fwrite`

The `fwrite` function writes `count` elements of data, each `size` bytes long, to the stream pointed to by `stream`, obtaining them from the location given by `ptr`. It returns the number of elements successfully written.

```c
size_t fwrite(const void *ptr, size_t size, size_t count, FILE *stream);
```

The `FILE *` struct pointer is already defined in Nim as `File`, so we can use that directly. Since we don't have something to write to yet, we'll just create an dummy implementation:

```nim
# src/libc.nim

proc fwrite*(ptr: constPointer, size: csize_t, count: csize_t, stream: File):
    csize_t {.exportc.} =
  return 0.csize_t
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

This clears the interrupt flag, then halts the CPU. The CPU can still be interrupted by NMI, SMI, or INIT, so that's why we have a loop to keep halting the CPU if this happens. The `asmNoStackFrame` pragma tells the compiler not to create a stack frame for this procedure, since it's pure assembly that we never return from.

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
  constPointer {.importc: "const void *".} = pointer
  constCString {.importc: "const char *".} = pointer


proc memset*(p: pointer, value: cint, size: csize_t): pointer {.exportc.} =
  let pp = cast[ptr UncheckedArray[byte]](p)
  let v = cast[byte](value)
  for i in 0..<size:
    pp[i] = v
  return p

proc memcpy*(dest: pointer, src: constPointer, size: csize_t): pointer {.exportc.} =
  let pdest = cast[ptr UncheckedArray[byte]](dest)
  let psrc = cast[ptr UncheckedArray[byte]](src)
  for i in 0 ..< size:
    pdest[i] = psrc[i]
  return dest

proc strlen*(str: constCString): csize_t {.exportc.} =
  let s = cast[ptr UncheckedArray[byte]](str)
  var len = 0
  while s[len] != 0:
    inc len
  result = len.csize_t

proc fwrite*(buf: constPointer, size: csize_t, count: csize_t, stream: File): csize_t {.exportc.} =
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

Great! We were able to compile and link our Nim code into a PE32+ executable that targets UEFI with no OS support.

