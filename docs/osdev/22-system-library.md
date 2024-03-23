# System Library

So far, we have three system calls: `print`, `yield`, and `exit`. It's going to be tedious to write everything in assembly, so we need to write a system library that wraps these system calls in procs that we can call from our user tasks. This library will be the interface between our user tasks and the kernel.

## Writing the Library

Let's create a new top-level directory called `syslib`, and inside it, we'll create two modules for our system calls: `io.nim` (for `print`), and `os.nim` (for `yield` and `exit`).

Let's start with `io.nim`.

```nim
# src/syslib/io.nim

