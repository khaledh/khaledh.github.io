# System Library

So far, we have three system calls: `print`, `yield`, and `exit`. It's going to be tedious
to write everything in assembly, so we need to write a system library that wraps these
system calls in procs that we can call from our user tasks. This library will be the
interface between our user tasks and the kernel.

## Writing the Library

Let's create a new top-level directory called `syslib`, and inside it, we'll create two
modules for our system calls: `io.nim` (for `print`), and `os.nim` (for `yield` and
`exit`). Since system call numbers need to be unique, let's define them in a common module
called `syscalldef.nim`.

```nim
# src/syslib/syscalldef.nim

const
  SysExit = 1
  SysPrint = 2
  SysYield = 3
```

Now let's add `io.nim`.

```nim
# src/syslib/io.nim
include syscalldef

proc print*(pstr: ptr string) =
  asm """
    mov rdi, %0
    mov rsi, %1
    syscall
    :
    : "i" (`SysPrint`), "m" (`pstr`)
    : "rdi", "rsi"
  """
```

This is our first system call wrapper, `print`. It takes a pointer to a string and passes
it to the kernel system call `SysPrint`.

Next, let's add `os.nim`.

```nim
# src/syslib/os.nim
include syscalldef

proc yld*() =
  asm """
    mov rdi, %0
    syscall
    :
    : "i" (`SysYield`)
    : "rdi"
  """

proc exit*(code: int) =
  asm """
    mov rdi, %0
    mov rsi, %1
    syscall
    :
    : "i" (`SysExit`), "r" (`code`)
    : "rdi", "rsi"
  """
```

These are the wrappers for `yield` and `exit`. `yield` doesn't take any arguments, so it
just passes the system call number to the kernel. `exit` takes an integer argument, which
is the exit code.

## Using the Library

It's time to put our brand new system library to use. Let's modify our user task to use
all three system calls, instead of the direct system calls we had before.

```nim{3,14-16}
# src/user/utask.nim
import common/[libc, malloc]
import syslib/[io, os]

proc NimMain() {.importc.}

let
  msg = "Hello from user mode!"
  pmsg = msg.addr

proc UserMain*() {.exportc.} =
  NimMain()

  print(pmsg)
  yld()
  exit(0)
```

This looks much cleaner and more readable than the assembly code we had before. We can now
write our user tasks in Nim, and the system library will take care of the system calls for
us.

Let's try it out.

```sh-session
...
kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -> 0
Hello from user mode!
syscall: yield
sched: switching 0 -> 1
Hello from user mode!
syscall: yield
sched: switching 1 -> 2
Hello from user mode!
syscall: yield
sched: switching 2 -> 0
syscall: exit: code=0
sched: switching 0 -> 1
syscall: exit: code=0
sched: switching 1 -> 2
syscall: exit: code=0
sched: no tasks to run, halting
```

No surprises, everything works as expected. We have successfully abstracted the system
calls into a library, making it easier to write user tasks without worry about the details
of system calls. We can now add more system calls to the library as we need them.

In the next few sections I'd like to tackle preemptive multitasking. This will require
receiving interrupts from a hardware timer. So far our interrupt support is limited to
handling CPU exceptions. For hardware interrupts we need to work with the interrupt
controller in our system, which we'll look at in the next section.
