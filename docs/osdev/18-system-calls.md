# System Calls

User programs run in a restricted environment. They can't access hardware directly, allocate memory, or do any privileged operations. Instead, they must ask the kernel to do these things for them. The kernel provides these services through system calls. System calls are the interface between user programs and the kernel.

Transferring control to the kernel requires special support from the CPU. Traditionally, this has been done using software interrupts, e.g. `int 0x80` in Linux. However, modern CPUs provide a more efficient way to do this: the `syscall`/`sysret` instruction pair.

## System Call Interface

The `syscall`/`sysret` instructions simply transfers control to the kernel and back to the user program. They don't define the interface between user programs and the kernel. The kernel defines this interface, i.e. the system call numbers and the arguments for each system call. The kernel also defines the calling convention for system calls, e.g. which registers to use for arguments and return values. This is called Application Binary Interface (ABI).

We're not building a kernel adhering to any particular ABI; we'll define our own. Let's start with the system call number and arguments. We'll use the following registers for these:

- `rdi`: system call number
- `rsi`: first argument
- `rdx`: second argument
- `rcx`: third argument
- `r8`: fourth argument
- `r9`: fifth argument

We'll use `rax` for the return value.

When executing `syscall`, the CPU stores the user `RIP` and `RFLAGS` in `rcx` and `r11` respectively. Upoin returning to user mode, the CPU restores `RIP` and `RFLAGS` from `rcx` and `r11`. So we have to make sure that `rcx` and `r11` are preserved across system calls.

Also, the CPU doesn't switch stacks for us when executing `syscall`. We have to do that ourselves. This is in contrast with interrupts, where the CPU switches to the kernel stack before executing the interrupt handler. So it's a bit more inconvenient to handle system calls than interrupts, but it's a faster mechanism.

## Initialization

There's a few things we need to do to initialize system calls. They're all done through Model Specific Registers (MSRs).

- Set the `SCE` (SYSCALL Enable) flag in the `IA32_EFER` MSR.
- Set the kernel and user mode segment selectors in the `IA32_STAR` MSR.
- Set the syscall entry point in the `IA32_LSTAR` MSR.
- Set the kernel mode CPU flags mask in the `IA32_FMASK` MSR.

Since we're going to be reading/writing CPU registers, let's create a module for that. Let's add `src/kernel/cpu.nim` and define some constants for the MSRs, and two procs to read/write them.

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

Now, let's create another module `src/kernel/syscalls.nim` and add a proc to initialize system calls, and a dummy syscall entry point.

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
  # note that for SYSCALL, the kernel segment selectors are:
  #   CS: IA32_STAR[47:32]
  #   SS: IA32_STAR[47:32] + 8
  # and for SYSRET, the user segment selectors are:
  #   CS: IA32_STAR[63:48] + 16
  #   SS: IA32_STAR[63:48] + 8
  # thus, setting both parts of the register to KernelCodeSegmentSelector
  # satisfies both requirements (+0 is kernrel CS, +8 is data segment, +16 is user CS)
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

The `syscallEntry` proc is a low-level entry point for system calls, hence the pure assembly. We can't rely on conventional prologue/epilogue code here, since the CPU doesn't switch stacks for us. We'll have to do that ourselves as early as possible in the entry point. Right now we just want to make sure that the syscall transition to kernel mode works.

The `syscallInit` proc does the actual initialization. It enables the syscall feature, sets up the segment selectors, sets the syscall entry point, and sets the flags mask. The flags mask is used to _clear_ the flags corresponding to the bits set in the mask when entering kernel mode.

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

We should now be able to invoke system calls from user mode. Let's modify our user program to do that. We're going to pass the system call number in `rdi`, but we won't pass any arguments for now.

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

The command `x /2i $eip-2` disassembles the two instructions just before the current instruction pointer, which shows that we're executing the `cli` and `hlt` instructions in `syscallEntry`. Just to double-check, we can confirm this by comparing the value of `rip` with the address of `syscallEntry` from the kernel linker map.

```text
ffff800000120490 ffff800000120490       4e    16    .../fusion/build/@msyscalls.nim.c.o:(.ltext.syscallEntry__syscalls_u23)
ffff800000120490 ffff800000120490       4e     1            syscallEntry__syscalls_u23
```

Indeed, the value of `rip - 2` is the same as the address of `syscallEntry`.

Now, let's check the CPU registers.

```text
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

We can also see that `CS` and `SS` are set to the kernel code and data segments, respectively, and their DPL=0. `rflags` also has the `IF` (interrupt flag) cleared. So everything looks good so far. Notice that `rsp` is set to `0x50000fc8`, which is within the user stack. As I mentioned earlier, we'll need to switch to the kernel stack ourselves.

Let's test `sysret` to make sure we can return to user mode. We'll modify `syscallEntry` to put a dummy value in `rax` as a return code, and then call `sysretq` (the `q` suffix is for returning to 64-bit mode; otherwise, `sysret` would return to 32-bit compatibility mode).

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

We're now executing the `pause` loop in `UserMain`, so we're back in user mode. Let's check the registers.

```text
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

We can see that `rip` is back in user space, and `CS` and `SS` are set to user code and data segments, respectively, and their DPL=3. The `rflags` are also restored to the user value with interrupts enabled. Everything looks good.

## Switching Stacks

TODO

## System Call Handler

TODO
