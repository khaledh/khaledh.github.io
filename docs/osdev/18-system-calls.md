# System Calls

User programs run in a restricted environment. They can't access hardware directly,
allocate memory, or do any privileged operations. Instead, they must ask the kernel to do
these things for them. The kernel provides these services through system calls. System
calls are the interface between user programs and the kernel.

Transferring control to the kernel requires special support from the CPU. Traditionally,
this has been done using software interrupts, e.g. `int 0x80` in Linux. However, modern
CPUs provide a more efficient way to do this: the `syscall`/`sysret` instruction pair.

## System Call Interface

The `syscall`/`sysret` instructions simply transfer control to the kernel and back to the
user program. They don't define the interface between user programs and the kernel. The
kernel defines this interface, i.e. the system call numbers and the arguments for each
system call. The kernel also defines the calling convention for system calls, e.g. which
registers to use for arguments and return values. This is called Application Binary
Interface (ABI).

We're not building a kernel adhering to any particular ABI; we'll define our own. Let's
start with the system call number and arguments. We'll use the following registers for
these:

- `rdi`: system call number
- `rsi`: first argument
- `rdx`: second argument
- `r8`: third argument
- `r9`: fourth argument
- `r10`: fifth argument

We'll use `rax` for the return value. Notice that we're not using `rcx` or `r11` in the
system call interface. This is because when executing `syscall`, the CPU stores the user
`rip` and `rflags` in `rcx` and `r11`, respectively. Upon returning to user mode, the CPU
restores `rip` and `rflags` from `rcx` and `r11`. So we have to make sure that `rcx` and
`r11` are preserved across system calls.

Also, the CPU doesn't switch stacks for us when executing `syscall`. We have to do that
ourselves. This is in contrast with interrupts, where the CPU switches to the kernel stack
before executing the interrupt handler. So it's a bit more inconvenient to handle system
calls than interrupts, but it's a faster mechanism.

## Initialization

There are a few things we need to do to initialize system calls. They're all done through
Model Specific Registers (MSRs).

- Set the `SCE` (SYSCALL Enable) flag in the `IA32_EFER` MSR.
- Set the kernel and user mode segment selectors in the `IA32_STAR` MSR.
- Set the syscall entry point in the `IA32_LSTAR` MSR.
- Set the kernel mode CPU flags mask in the `IA32_FMASK` MSR.

Since we're going to be reading/writing CPU registers, let's create a module for that.
Let's add `src/kernel/cpu.nim` and define some constants for the MSRs, and two procs to
read/write them.

```nim
# src/kernel/cpu.nim

const
  IA32_EFER* = 0xC0000080'u32

  IA32_STAR* = 0xC0000081'u32
  IA32_LSTAR* = 0xC0000082'u32
  IA32_FMASK* = 0xC0000084'u32

proc readMSR*(ecx: uint32): uint64 =
  var eax, edx: uint32
  asm """
    rdmsr
    : "=a"(`eax`), "=d"(`edx`)
    : "c"(`ecx`)
  """
  result = (edx.uint64 shl 32) or eax

proc writeMSR*(ecx: uint32, value: uint64) =
  var eax, edx: uint32
  eax = value.uint32
  edx = (value shr 32).uint32
  asm """
    wrmsr
    :
    : "c"(`ecx`), "a"(`eax`), "d"(`edx`)
  """
```

Now, let's create another module `src/kernel/syscalls.nim` and add a proc to initialize
system calls, and a dummy syscall entry point.

```nim
# src/kernel/syscalls.nim

import cpu
import gdt

proc syscallEntry() {.asmNoStackFrame.} =
  # just halt for now
  asm """
    cli
    hlt
  """

proc syscallInit*() =
  # enable syscall feature
  writeMSR(IA32_EFER, readMSR(IA32_EFER) or 1)  # Bit 0: SYSCALL Enable

  # set up segment selectors in IA32_STAR (Syscall Target Address Register)
  #
  # we use KernelCodeSegmentSelector for both parts of the register (47:32 and 63:48)
  # so for SYSCALL, the kernel segment selectors are:
  #   CS: IA32_STAR[47:32]         <-- KernelCodeSegmentSelector
  #   SS: IA32_STAR[47:32] + 8     <-- DataSegmentSelector (shared)
  #
  # and for SYSRET, the user segment selectors are:
  #   CS: IA32_STAR[63:48] + 16    <-- UserCodeSegmentSelector
  #   SS: IA32_STAR[63:48] + 8     <-- DataSegmentSelector (shared)
  #
  # thus, setting both parts of the register to KernelCodeSegmentSelector
  # satisfies both requirements (+0 is kernel CS, +8 is shared data segment, +16 is user CS)
  let star = (
    (KernelCodeSegmentSelector.uint64 shl 32) or
    (KernelCodeSegmentSelector.uint64 shl 48)
  )
  writeMSR(IA32_STAR, star)

  # set up syscall entry point
  writeMSR(IA32_LSTAR, cast[uint64](syscallEntry))

  # set up flags mask (should mask interrupt flag to disable interrupts)
  writeMSR(IA32_FMASK, 0x200)  # rflags will be ANDed with the *complement* of this value
```

The `syscallEntry` proc is a low-level entry point for system calls, hence the pure
assembly. We can't rely on conventional prologue/epilogue code here, since the CPU doesn't
switch stacks for us. We'll have to do that ourselves as early as possible in the entry
point. Right now we just want to make sure that the syscall transition to kernel mode
works.

The `syscallInit` proc does the actual initialization. It enables the syscall feature,
sets up the segment selectors, sets the syscall entry point, and sets the flags mask. The
flags mask is used to _clear_ the flags corresponding to the bits set in the mask when
entering kernel mode.

Finally, let's call `syscallInit` from `src/kernel/main.nim`.

```nim{3,12-14}
# src/kernel/main.nim

import syscalls
..

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  ...

  debug "kernel: Initializing Syscalls "
  syscallInit()
  debugln "[success]"
```

## Invoking System Calls

We should now be able to invoke system calls from user mode. Let's modify our user program
to do that. We're going to pass the system call number in `rdi`, but we won't pass any
arguments for now.

```nim{8}
# src/user/utask.nim
...

proc UserMain*() {.exportc.} =
  NimMain()

  asm """
    mov rdi, 1
    syscall

  .loop:
    pause
    jmp .loop
  """
```

Let's try this out and use the QEMU monitor to check where execution stops.

```text
(qemu) x /2i $eip-2
0xffff800000120490:  fa                       cli
0xffff800000120491:  f4                       hlt
```

The command `x /2i $eip-2` disassembles the two instructions just before the current
instruction pointer, which shows that we're executing the `cli` and `hlt` instructions in
`syscallEntry`. Just to double-check, we can confirm this by comparing the value of `rip`
with the address of `syscallEntry` from the kernel linker map.

```text
ffff800000120490 ffff800000120490       4e    16    .../fusion/build/@msyscalls.nim.c.o:(.ltext.syscallEntry__syscalls_u23)
ffff800000120490 ffff800000120490       4e     1            syscallEntry__syscalls_u23
```

Indeed, the value of `rip - 2` is the same as the address of `syscallEntry`.

Now, let's check the CPU registers.

```text{3-5,9-10}
(qemu) info registers
CPU#0
RAX=ffff800000327540 RBX=ffff800000327548 RCX=0000000040000067 RDX=000000004000add8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=0000000000000000 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=ffff8000001204a9 RFL=00000002 [-------] CPL=0 II=0 A20=1 SMM=0 HLT=1
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =0008 0000000000000000 ffffffff 00a09b00 DPL=0 CS64 [-RA]
SS =0010 0000000000000000 ffffffff 00c09300 DPL=0 DS   [-WA]
DS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
FS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
GS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT
TR =0020 ffff800000326430 00000067 00008900 DPL=0 TSS64-avl
GDT=     ffff8000003264d0 0000002f
IDT=     ffff800000326500 00000fff
```

The three registers important to us here are `rcx`, `r11`, and `rdi`:

- `rcx` contains the user `rip` to return to after the system call (`0x40000067`)
- `r11` contains the user `rflags` to restore after the system call (`0x202`)
- `rdi` contains the system call number (`1`)

We can also see that `CS` and `SS` are set to the kernel code and data segments,
respectively, and their DPL=0. `rflags` also has the `IF` (interrupt flag) cleared. So
everything looks good so far. Notice that `rsp` is set to `0x50000fc8`, which is within
the user stack. As I mentioned earlier, we'll need to switch to the kernel stack
ourselves.

Let's test `sysret` to make sure we can return to user mode. We'll modify `syscallEntry`
to put a dummy value in `rax` as a return code, and then call `sysretq` (the `q` suffix is
for returning to 64-bit mode; otherwise, `sysret` would return to 32-bit compatibility
mode).

```nim{6}
# src/kernel/syscalls.nim
...

proc syscallEntry() {.asmNoStackFrame.} =
  asm """
    mov rax, 0x5050
    sysretq
  """
```

Let's run it and see where we stop.

```text
(qemu) x /2i $eip-2
0x40000067:  f3 90                    pause
0x40000069:  e9 f9 ff ff ff           jmp      0x40000067
```

We're now executing the `pause` loop in `UserMain`, so we're back in user mode. Let's
check the registers.

```text{3,7,9-10}
(qemu) info registers
CPU#0
RAX=0000000000005050 RBX=0000000000000000 RCX=0000000040000067 RDX=000000004000add8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=000000000636d001 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=0000000040000069 RFL=00000202 [-------] CPL=3 II=0 A20=1 SMM=0 HLT=0
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =001b 0000000000000000 ffffffff 00a0fb00 DPL=3 CS64 [-RA]
SS =0013 0000000000000000 ffffffff 00c0f300 DPL=3 DS   [-WA]
DS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
FS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
GS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT
TR =0020 ffff8000003263f0 00000067 00008900 DPL=0 TSS64-avl
GDT=     ffff800000326490 0000002f
IDT=     ffff8000003264c0 00000fff
```

We can see that `rip` is back in user space, and `CS` and `SS` are set to user code and
data segments, respectively, and their DPL=3. The `rflags` are also restored to the user
value with interrupts enabled. Everything looks good.

## Switching Stacks

As I mentioned earlier, the CPU doesn't switch stacks for us when executing `syscall`. We
need to switch to a kernel stack ourselves. We'll use the same stack we use for
interrupts, the one we stored its address in `tss.rsp0`. We'll also need to save the user
`rsp` somewhere so we can restore it later. We'll define two global variables for this in
the `syscalls` module.

```nim
# src/kernel/syscalls.nim

var
  kernelStackAddr: uint64
  userRsp: uint64
...

proc syscallInit*(kernelStack: uint64) =
  kernelStackAddr = kernelStack
  ...
```

Let's pass the kernel stack address to `syscallInit` from `main.nim`.

```nim{15-17}
# src/kernel/main.nim

import syscalls

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  ...

  # create a kernel switch stack and set tss.rsp0
  debugln "kernel: Creating kernel switch stack"
  ...

  debug "kernel: Initializing Syscalls "
  syscallInit(tss.rsp0)
  debugln "[success]"

  ...
```

Now, let's modify `syscallEntry` to switch to the kernel stack and save the user `rsp`.
We'll also push `rcx` and `r11` (user `rip` and `rflags`, respectively) on the kernel
stack and restore them before calling `sysretq` to return to user mode.

```nim
# src/kernel/syscalls.nim

proc syscallEntry() {.asmNoStackFrame.} =
  asm """
    # save user stack pointer
    mov %0, rsp

    # switch to kernel stack
    mov rsp, %1

    push r11  # user rflags
    push rcx  # user rip

    # TODO: dispatch system call

    # restore user rip and rflags
    pop r11
    pop rcx

    # switch to user stack
    mov rsp, %0

    sysretq
    : "+r"(`userRsp`)
    : "m"(`kernelStackAddr`)
    : "rcx", "r11"
  """
```

Right now, we're not doing much to handle the system call itself. We're just switching
stacks, and saving and restoring the user `rip` and `rflags`. In order to do something
useful, we need to define a system call handler and a way to pass arguments to it.

## System Call Handler

Let's now define the actual system call handler. We'll define a `SyscallArgs` type to hold
the system call number and arguments, and implement a `syscall` proc that takes a pointer
to `SyscallArgs` and returns a `uint64` as the return value.

```nim
# src/kernel/syscalls.nim

type
  SyscallArgs = object
    num: uint64   # rdi
    arg1: uint64  # rsi
    arg2: uint64  # rdx
    arg3: uint64  # r8
    arg4: uint64  # r9
    arg5: uint64  # r10

...

proc syscall*(args: ptr SyscallArgs): uint64 {.exportc.} =
  debugln &"syscall: num={args.num}"
  result = 0x5050  # dummy return value
```

Notice that we're using the `exportc` pragma to export the `syscall` proc, since we'll be
calling it from assembly code.

Now, let's modify `syscallEntry` to call `syscall` with the system call number and
arguments. We'll create the `SyscallArgs` object on the kernel stack by pushing the
appropriate registers, and pass its address to `syscall`.

```nim{15-33,45}
# src/kernel/syscalls.nim
...

proc syscallEntry() {.asmNoStackFrame.} =
  asm """
    # save user stack pointer
    mov %0, rsp

    # switch to kernel stack
    mov rsp, %1

    push r11  # user rflags
    push rcx  # user rip

    # create SyscallArgs on the stack
    push r10
    push r9
    push r8
    push rdx
    push rsi
    push rdi

    # rsp is now pointing to SyscallArgs, pass it to syscall
    mov rdi, rsp
    call syscall

    # pop SyscallArgs
    pop rdi
    pop rsi
    pop rdx
    pop r8
    pop r9
    pop r10

    # prepare for sysretq
    pop rcx  # user rip
    pop r11  # user rflags

    # switch to user stack
    mov rsp, %0

    sysretq
    : "+r"(`userRsp`)
    : "m"(`kernelStackAddr`)
    : "rcx", "r11", "rdi", "rsi", "rdx", "r8", "r9", "r10", "rax"
  """
```

Notice that on the last line we're telling the compiler that `syscallEntry` clobbers the
indicated registers. Otherwise, the compiler might try to use them for other purposes.

Let's try this out. We still have the user program passing `1`, so we should see that
printed by `syscall`, and the dummy return value `0x5050` should be in `rax` when we
return to user mode.

```text
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
```

Great! The `syscall` proc was called and received the correct syscall number. Let's look
at the `rax` register to see if it contains the dummy return value.

```text{3}
(qemu) info registers
CPU#0
RAX=0000000000005050 RBX=ffff800000327220 RCX=0000000040000074 RDX=000000004000ade8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=0000000050000fc8 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=0000000040000076 RFL=00000202 [-------] CPL=3 II=0 A20=1 SMM=0 HLT=0
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =001b 0000000000000000 ffffffff 00a0fb00 DPL=3 CS64 [-RA]
SS =0013 0000000000000000 ffffffff 00c0f300 DPL=3 DS   [-WA]
...
```

Indeed, `rax` contains `0x5050`, and from the `rip`, `cs`, and `ss` register values we can
see that we're back in user mode. So everything is working as expected.

## System Call Table

Over time, we'll have more system calls, so we'll need a way to dispatch them. One way to
do this is store the system call handlers in a table indexed by the system call number.
Let's create that table.

```nim{4,8-10,12-13,19-21}
# src/kernel/syscalls.nim

type
  SyscallHandler* = proc (args: ptr SyscallArgs): uint64 {.cdecl.}
  SyscallArgs = object
    num: uint64
    arg1, arg2, arg3, arg4, arg5: uint64
  SyscallError* = enum
    None
    InvalidSyscall

var
  syscallTable: array[256, SyscallHandler]

...

proc syscall*(args: ptr SyscallArgs): uint64 {.exportc.} =
  debugln &"syscall: num={args.num}"
  if args.num > syscallTable.high.uint64 or syscallTable[args.num] == nil:
    return InvalidSyscall.uint64
  result = syscallTable[args.num](args)
```

Now, let's define a system call to output a string to the debug console. The system call
will take one argument: a pointer to a `string` object containing the string to output.
We'll register the system call handler in `syscallInit`.

```nim
# src/kernel/syscalls.nim
...

proc print*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln "syscall: print"
  let s = cast[ptr string](args.arg1)
  debugln s[]
  result = 0

proc syscallInit*(kernelStack: uint64) =
  ...
  syscallTable[1] = print
  ...
```

Let's try to invoke this system call from our user program.

```nim{4-6,12,20-21}
# src/user/utask.nim
...

let
  msg = "user: Hello from user mode!"
  pmsg = msg.addr

proc UserMain*() {.exportc.} =
  NimMain()

  asm """
    mov rdi, 1
    mov rsi, %0
    syscall

  .loop:
    pause
    jmp .loop
    :
    : "r"(`pmsg`)
    : "rdi", "rsi", "rcx", "r11"
  """
```

We're passing the system call number `1` in `rdi`, and the address of the string in
`rsi`. Notice that we tell the compiler that the `rcx` and `r11` registers are clobbered
(they will be modified by the CPU during the syscall). Let's run it and see what happens.

```text
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
syscall: print
user: Hello from user mode!
```

Great! We can now ask the kernel to print a string for us. This is our first kernel
service provided through a system call!

## Argument Validation

There's one important piece missing though. Arguments to system calls have to be validated
thoroughly. We can't just blindly trust the user program to pass valid arguments. We
already did this for the system call number. But what about the string pointer? The user
can pass any pointer value, so it's imperative that we validate it before dereferencing
it. In this case, we'll keep it simple and make sure that the pointer is within the user
address space. We can check if it's mapped, but that's going to be expensive. Instead,
we'll just check if it's within the user address space range, and if it isn't mapped,
we'll let the page fault handler deal with it.

Here's the modified `print` system call.

```nim{9-10,17-19}
# src/kernel/syscalls.nim

type
  SyscallError* = enum
    None
    InvalidSyscall
    InvalidArg

const
  UserAddrSpaceEnd* = 0x00007FFFFFFFFFFF

...

proc print*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln "syscall: print"

  if args.arg1 > UserAddrSpaceEnd:
    debugln "syscall: print: Invalid pointer"
    return InvalidArg.uint64

  let s = cast[ptr string](args.arg1)
  debugln s[]

  result = 0
```

Let's try it out by passing an address in kernel space to the system call.

```nim{5}
# src/user/utask.nim

let
  msg = "user: Hello from user mode!"
  pmsg = 0xffff800000100000  # kernel space address

...
```

If we run this, we should see the error message printed by the kernel.

```text
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
syscall: print
syscall: print: Invalid pointer
```

Awesome! Our argument validation works as expected.

## The `exit` System Call

Before we leave this section, let's add one more system call: `exit`. This system call
will take one argument: the exit code. Keep in mind that we don't have a scheduler yet;
our kernel transferred control to the user program, the user program called a system call
to print a message, and will exit user mode in one thread of execution. So, without other
tasks to switch to at the moment, we'll just halt the CPU when the user program exits.

```nim
# src/kernel/syscalls.nim

proc exit*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln &"syscall: exit: code={args.arg1}"
  asm """
    cli
    hlt
  """
```

We'll give the `exit` system call the number 1 instead of `print`, and we'll make print
system call number 2.

```nim{12-13,17}
# src/kernel/syscalls.nim
...

proc syscallInit*(kernelStack: uint64) =
  ...
  syscallTable[1] = exit
  syscallTable[2] = print
  ...
```

Now, let's modify the user program to call `exit` after printing the message.

```nim{8-9,13-16}
# src/user/utask.nim
...

proc UserMain*() {.exportc.} =
  NimMain()

  asm """
    # call print
    mov rdi, 2
    mov rsi, %0
    syscall

    # call exit
    mov rdi, 1
    mov rsi, 0
    syscall
    :
    : "r"(`pmsg`)
    : "rdi", "rsi", "rcx", "r11"
  """
```

Notice that I removed the infinite loop, as the `exit` syscall does not return. Let's run
it and see what happens.

```text
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=2
syscall: print
user: Hello from user mode!
syscall: num=1
syscall: exit: code=0
```

Looks good! The `exit` system call was called and received the correct exit code, and the
kernel halted the CPU.

This is another big milestone. We now have a working system call interface, and we can
invoke kernel services from user mode. In the next section, we'll look into encapsulating
user task related context in a `Task` object.
