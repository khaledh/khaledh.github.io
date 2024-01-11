# Task State Segment

While running in user mode, an interrupt/exception or a system call causes the CPU to switch to kernel mode. This causes a change in privilege level (from CPL=3 to CPL=0). The CPU cannot use the user stack while in kernel mode, since the interrupt could have been caused by something that makes the stack unusable, e.g. a page fault caused by running out of stack space. So, the CPU needs to switch to a known good stack. This is where the Task State Segment (TSS) comes in.

The TSS originally was designed to support hardware task switching. This is a feature that allows the CPU to switch between multiple tasks (each having its own TSS) without software intervention. This feature is not used in modern operating systems, which rely on software task switching, but the TSS is still used to switch stacks when entering kernel mode.

The TSS on x64 contains two sets of stack pointers:

* One set holds three stack pointers, `RSP0`, `RSP1`, and `RSP2`, to use when switching to CPL=0, CPL=1, and CPL=2, respectively. Typically, only `RSP0` is used when switching from user mode to kernel mode, since rings 1 and 2 are not used in modern operating systems.
* The other set holds so-called Interrupt Stack Table, which can hold up to seven stack pointers, `IST1` through `IST7`, to use when handling interrupts. The decision to use one of those stacks is made by the Interrupt Descriptor Table entry for the interrupt. The stack pointer to use is stored in the `IST` field of the IDT entry. This means that different interrupts can use different stacks. If an IDT entry doesn't specify a stack, the CPU uses the stack pointed to by `RSP0`.

Here's a diagram of the TSS structure:

```text
                 64-bit TSS Structure
   31                                              00
  ┌────────────────────────┬────────────────────────┐
  │ I/O Map Base Address   │        Reserved        │ 100
  ├────────────────────────┴────────────────────────┤
  │                  Reserved                       │ 96
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 92
  ├─────────────────────────────────────────────────┤
  │                  IST7 (hi)                      │ 88
  ├─────────────────────────────────────────────────┤
  │                  IST7 (lo)                      │ 84
  ├─────────────────────────────────────────────────┤
  │                     ...                         │
  ├─────────────────────────────────────────────────┤
  │                  IST1 (hi)                      │ 40
  ├─────────────────────────────────────────────────┤
  │                  IST1 (lo)                      │ 36
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 32
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 28
  ├─────────────────────────────────────────────────┤
  │                  RSP2 (hi)                      │ 24
  ├─────────────────────────────────────────────────┤
  │                  RSP2 (lo)                      │ 20
  ├─────────────────────────────────────────────────┤
  │                  RSP1 (hi)                      │ 16
  ├─────────────────────────────────────────────────┤
  │                  RSP1 (lo)                      │ 12
  ├─────────────────────────────────────────────────┤
  │                  RSP0 (hi)                      │ 8
  ├─────────────────────────────────────────────────┤
  │                  RSP0 (lo)                      │ 4
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 0
  └─────────────────────────────────────────────────┘
```

So, how does the CPU find the TSS? There's a special register called `TR` (Task Register) that holds the segment selector of the TSS. The CPU uses this selector to find the TSS in the GDT. So, what we need to do is to create a TSS and load its selector into `TR`.

## Creating a TSS

Let's define the TSS structure in `src/kernel/gdt.nim`

```nim
# src/kernel/gdt.nim

type
  TaskStateSegment {.packed.} = object
    reserved0: uint32
    rsp0: uint64
    rsp1: uint64
    rsp2: uint64
    reserved1: uint64
    ist1: uint64
    ist2: uint64
    ist3: uint64
    ist4: uint64
    ist5: uint64
    ist6: uint64
    ist7: uint64
    reserved2: uint64
    reserved3: uint16
    iomapBase: uint16
```

We'll need to define a new descriptor type for the TSS, so that we can add it to the GDT. This will be a system descriptor (as opposed to a code or data descriptor).

```nim
# src/kernel/gdt.nim

type
  TaskStateSegmentDescriptor {.packed.} = object
    limit00: uint16
    base00: uint16
    base16: uint8
    `type`* {.bitsize: 4.}: uint8 = 0b1001  # 64-bit TSS
    s {.bitsize: 1.}: uint8 = 0  # System segment
    dpl* {.bitsize: 2.}: uint8
    p* {.bitsize: 1.}: uint8 = 1
    limit16 {.bitsize: 4.}: uint8
    avl* {.bitsize: 1.}: uint8 = 0
    zero1 {.bitsize: 1.}: uint8 = 0
    zero2 {.bitsize: 1.}: uint8 = 0
    g {.bitsize: 1.}: uint8 = 0
    base24: uint8
    base32: uint32
    reserved1: uint8 = 0
    zero3 {.bitsize: 5.}: uint8 = 0
    reserved2 {.bitsize: 19.}: uint32 = 0
```

Now, let's create an instance of the TSS and a descriptor for it. Later, we'll create a kernel stack and set `RSP0` to point to it.

```nim
# src/kernel/gdt.nim

var
  tss* = TaskStateSegment()

let
  tssDescriptor = TaskStateSegmentDescriptor(
    dpl: 0,
    base00: cast[uint16](tss.addr),
    base16: cast[uint8](cast[uint64](tss.addr) shr 16),
    base24: cast[uint8](cast[uint64](tss.addr) shr 24),
    base32: cast[uint32](cast[uint64](tss.addr) shr 32),
    limit00: cast[uint16](sizeof(tss) - 1),
    limit16: cast[uint8]((sizeof(tss) - 1) shr 16)
  )
  tssDescriptorLo = cast[uint64](tssDescriptor)
  tssDescriptorHi = (cast[ptr uint64](cast[uint64](tssDescriptor.addr) + 8))[]
```

Finally, let's add the descriptor to the GDT and define its selector. Notice that the GDT entry occupies two 64-bit slots (since the TSS descriptor is 128 bits long). The selector points to the first slot (the low 64 bits).

```nim{8,18-19}
# src/kernel/gdt.nim
...

const
  KernelCodeSegmentSelector* = 0x08
  UserCodeSegmentSelector* = 0x10 or 3 # RPL = 3
  DataSegmentSelector* = 0x18 or 3     # RPL = 3
  TaskStateSegmentSelector* = 0x20

let
  ...

  gdtEntries = [
    NullSegmentDescriptor.value,
    CodeSegmentDescriptor(dpl: 0).value, # Kernel code segment
    CodeSegmentDescriptor(dpl: 3).value, # User code segment
    DataSegmentDescriptor(dpl: 3).value, # Data segment
    tssDescriptorLo,                     # Task state segment (low 64 bits)
    tssDescriptorHi,                     # Task state segment (high 64 bits)
  ]
```

## Loading the TSS

To tell the CPU to use the TSS, we need to load its selector into `TR` (Task Register). We'll do this as part of the `gdtInit` proc.

```nim{9-10,19}
# src/kernel/gdt.nim
...

proc gdtInit*() {.asmNoStackFrame.} =
  ...
  asm """
    lgdt %0

    mov ax, %3
    ltr ax

    # reload CS using a far return
    ...

    :
    : "m"(`gdtDescriptor`),
      "i"(`KernelCodeSegmentSelector`),
      "i"(`DataSegmentSelector`),
      "i"(`TaskStateSegmentSelector`)
    : "rax" 
  """
```

## Kernel Switch Stack

We now need to define a new stack to use when switching to kernel mode. Let's allocate a page for it, map it, and set the `RSP0` field of the TSS to point to it.

```nim{10-22}
# src/kernel/main.nim
...

proc KernelMain(bootInfo: ptr BootInfo) {.exportc.} =
  ...

  # allocate and map user stack
  ...

  # create a kernel switch stack and set tss.rsp0
  debugln "kernel: Creating kernel switch stack"
  let switchStackPhysAddr = pmAlloc(1).get
  let switchStackVirtAddr = p2v(switchStackPhysAddr)
  mapRegion(
    pml4 = kpml4,
    virtAddr = switchStackVirtAddr,
    physAddr = switchStackPhysAddr,
    pageCount = 1,
    pageAccess = paReadWrite,
    pageMode = pmSupervisor,
  )
  tss.rsp0 = uint64(switchStackVirtAddr +! PageSize)

  # create interrupt stack frame
  ...
```

Everything is now ready for the switch to kernel mode. There are a few ways to try this out.

## Switching to Kernel Mode

One way to test this is to have the user task try to execute a privileged instruction, such as `hlt`. This should cause a General Protection Fault exception, which will trigger the switch to kernel mode. Let's try this out.

```nim
# src/user/utask.nim
...

proc UserMain*() {.exportc.} =
  NimMain()

  asm "hlt"
```

Let's run and see what happens.

```text
kernel: Fusion Kernel
...
kernel: Creating kernel switch stack
kernel: Creating interrupt stack frame
            SS: 0x1b
           RSP: 0x50001000
        RFLAGS: 0x202
            CS: 0x13
           RIP: 0x40000000
kernel: Switching to user mode

CPU Exception: General Protection Fault

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(65) cpuGeneralProtectionFaultHandler
```

As expected, the CPU switched to kernel mode and executed the General Protection Fault handler! Let's try another way. Let's cause a page fault by trying to access a page that's not mapped.

```nim
# src/user/utask.nim
...

proc UserMain*() {.exportc.} =
  NimMain()

  # access illegal memory
  var x = cast[ptr int](0xdeadbeef)
  x[] = 42
```

We should see a page fault exception at the address `0xdeadbeef`.

```text
...
kernel: Switching to user mode

CPU Exception: Page Fault
    Faulting address: 0x00000000deadbeef

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(57) cpuPageFaultHandler
```

Great! OK, one more way. Let's try to access an address within kernel space. This should also cause a Page Fault exception, even though the address is mapped.

```nim
# src/user/utask.nim

proc UserMain*() {.exportc.} =
  NimMain()

  # access kernel memory
  var x = cast[ptr int](0xFFFF800000100000)  # kernel entry point
  x[] = 42
```

Let's see what happens.

```text
...
kernel: Switching to user mode

CPU Exception: Page Fault
    Faulting address: 0xffff800000100000

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(57) cpuPageFaultHandler
```

Great! This demonstrates that kernel memory is protected from access by user code.

## Invoking Interrupts from User Mode

Finally, let's try to invoke an interrupt from user mode. Let's reuse the `isr100` interrupt handler we used for testing earlier.

```nim
# src/kernel/idt.nim
...

proc isr100(frame: pointer) {.cdecl, codegenDecl: "__attribute__ ((interrupt)) $# $#$#".} =
  debugln "Hello from isr100"
  quit()

proc idtInit*() =
  ...

  installHandler(100, isr100)
  ...
```

Let's execute the `int` instruction from user mode.

```nim
# src/user/utask.nim

proc UserMain*() {.exportc.} =
  NimMain()

  asm "int 100"
```

If we try to run this, we are faced with a General Protection Fault exception.

```text
...
kernel: Switching to user mode

CPU Exception: General Protection Fault

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(66) cpuGeneralProtectionFaultHandler
```

The reason has to do with the `DPL` of the interrupt gate. Recall that the `DPL` of the interrupt gate must be greater than or equal to the `CPL` of the code that invokes the interrupt. In this case, the `DPL` of the interrupt gate is 0, while the `CPL` of the user code is 3. So, the CPU raises a General Protection Fault exception.

Let's fix this by allowing the `isr100` handler to be called from user mode. We need to do a couple of modifications in the `idt.nim` module to allow setting the `dpl` field of the interrupt gate.

```nim{3,9,12-13,20}
...

proc newInterruptGate(handler: InterruptHandler, dpl: uint8 = 0): InterruptGate =
  let offset = cast[uint64](handler)
  result = InterruptGate(
    offset00: uint16(offset),
    offset16: uint16(offset shr 16),
    offset32: uint32(offset shr 32),
    dpl: dpl,
  )

proc installHandler*(vector: uint8, handler: InterruptHandler, dpl: uint8 = 0) =
  idtEntries[vector] = newInterruptGate(handler, dpl)

...

proc idtInit*() =
  ...

  installHandler(100, isr100, dpl = 3)
  ...
```

Let's try again.

```text
kernel: Switching to user mode
Hello from isr100
```

Great! We can call interrupts from user mode. We're now ready to start looking into system calls.
