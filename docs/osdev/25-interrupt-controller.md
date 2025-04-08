# Interrupt Controller

The legacy x86 architecture featured a single interrupt controller, the 8259A Programmable
Interrupt Controller (PIC), responsible for managing hardware interrupts. The PIC is a
simple device that is limited to 8 interrupts (15 if cascaded with another PIC), and is
limited in terms of interrupt priority, routing flexibility, and multiprocessor support.

The PIC is now considered obsolete, and modern x86 systems use the Advanced Programmable
Interrupt Controller (APIC) architecture. The APIC architecture consists of two main
components: the I/O APIC and the Local APIC. The I/O APIC is responsible for managing
interrupts from external devices (usually there is only one in the system), while the
Local APIC is integrated into each CPU core and is responsible for managing interrupts
delivered to the CPU core (whether from the I/O APIC or from the Local APIC of other CPU
cores), as well as interrupts from internal sources such as the Local APIC timer. For this
reason, we will focus on the Local APIC in this section.

## Local APIC

The Local APIC is responsible for managing interrupts delivered to its associated core.
The interrupts it delivers can originate from internal sources, such as its timer, thermal
sensors, and performance monitoring counters, or from external sources, such as the I/O
APIC and Inter-Processor Interrupts (IPI).

The following is a simplified diagram of the relevant components of the Local APIC (there
are more components, but we won't need them for now):

```
┌─────────────────────────────┐
│      Version Register       │
└─────────────────────────────┘

┌──────────────────────────────┐ ◄──┐
│    Current Count Register    │    │
├──────────────────────────────┤    │
│    Initial Count Register    │    ├── Timer Registers
├──────────────────────────────┤    │
│     Divide Configuration     │    │
└──────────────────────────────┘ ◄──┘

┌──────────────────────────────┐ ◄──┐
│            Timer             │    │
├──────────────────────────────┤    │
│          Local INT0          │    │
├──────────────────────────────┤    │
│          Local INT1          │    │
├──────────────────────────────┤    ├── Local Vector Table (LVT)
│  Perf. Monitoring Counters   │    │
├──────────────────────────────┤    │
│        Thermal Sensors       │    │
├──────────────────────────────┤    │
│        Error Register        │    │
└──────────────────────────────┘ ◄──┘

┌──────────────────────────────┐
┆       Other registers...     ┆
```

The Local APIC is memory-mapped, typically at physical address `0xFEE00000`; the actual
address should be read from the `IA32_APIC_BASE` MSR. Although the address is the same for
all cores, they operate independently and can be programmed separately. Here's a diagram
of this MSR:

```
                                IA32_APIC_BASE MSR
 
 63             MAX_PHYS_ADDR                          12 11 10  9  8 7         0
┌────────────────────────────┬───────────────────────────┬──┬─────┬──┬───────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░│         APIC Base         │  │░░░░░│  │░░░░░░░░░░░│
└────────────────────────────┴───────────────────────────┴──┴─────┴──┴───────────┘
                                           ▲               ▲        ▲
              Physical base address ───────┘               │        │
         APIC global enable/disable ───────────────────────┘        │
             BSP - Processor is BSP ────────────────────────────────┘
```

The APIC is programmed by writing to its registers, which are 32 bits wide and located at
fixed offsets from the base address. The registers occupy one frame of physical memory
address space, from `0xFEE00000` to `0xFEEFFFFF`, although currently not all this space is
used.

Since the base address we get from the `IA32_APIC_BASE` MSR is a physical address, we
can't use it directly; we need to map a page of virtual memory to it first, and then use
that virtual memory region to access the APIC registers. Also note this description from
the Intel manual:

> **APIC Base field, bits 12 through 35**: Specifies the base address of the APIC
> registers. This 24-bit value is extended by 12 bits at the low end to form the base
> address. This automatically aligns the address on a 4-KByte boundary.

So we'll need to shift the base address left by 12 bits to get the physical address of the
APIC. Since the address is already aligned to a page boundary, we can use it directly when
mapping it to virtual memory.

Let's start by creating a new module `lapic.nim` and defining a type for the
`IA32_APIC_BASE` MSR so that we can read it and get the physical address of the Local
APIC.

```nim
# src/kernel/lapic.nim

type
  IA32ApicBaseMsr {.packed.} = object
    reserved1   {.bitsize:  8.}: uint64
    isBsp       {.bitsize:  1.}: uint64  # Is Bootstrap Processor?
    reserved2   {.bitsize:  2.}: uint64
    enabled     {.bitsize:  1.}: uint64  # APIC Enabled?
    baseAddress {.bitsize: 24.}: uint64  # Physical Base Address (bits 12-35)
    reserved3   {.bitsize: 28.}: uint64
```

Let's import our `vmm` module so that we can map the APIC region, and let's define a proc
to initialize the base virtual address of the APIC.

```nim
import vmm

var
  apicBaseAddress: uint64

proc initBaseAddress() =
  let apicBaseMsr = cast[Ia32ApicBaseMsr](readMSR(IA32_APIC_BASE))
  let apicPhysAddr = (apicBaseMsr.baseAddress shl 12).PhysAddr
  # by definition, apicPhysAddr is aligned to a page boundary, so we map it directly
  let apicVMRegion = vmalloc(kspace, 1)
  mapRegion(
    pml4 = kpml4,
    virtAddr = apicVMRegion.start,
    physAddr = apicPhysAddr,
    pageCount = 1,
    pageAccess = paReadWrite,
    pageMode = pmSupervisor,
    noExec = true
  )
  apicBaseAddress = apicVMRegion.start.uint64
```

The APIC has many registers at different offsets from the base address, each register is
32 bits wide. Let's define the offsets of those registers. The registers we are interested
in are pointed out with comments, as we'll use them later to initialize the APIC and
program the timer. And while we're at it, let's also add a couple of procs to read from
and write to the APIC registers.

```nim
type
  LapicOffset = enum
    LapicId            = 0x020
    LapicVersion       = 0x030
    TaskPriority       = 0x080
    ProcessorPriority  = 0x0a0
    Eoi                = 0x0b0 # ◄────── End Of Interrupt Register
    LogicalDestination = 0x0d0
    DestinationFormat  = 0x0e0
    SpuriousInterrupt  = 0x0f0 # ◄────── Spurious Interrupt Vector Register
    InService          = 0x100
    TriggerMode        = 0x180
    InterruptRequest   = 0x200
    ErrorStatus        = 0x280
    LvtCmci            = 0x2f0
    InterruptCommandLo = 0x300
    InterruptCommandHi = 0x310
    LvtTimer           = 0x320 # ◄────── LVT Timer Register
    LvtThermalSensor   = 0x330
    LvtPerfMonCounters = 0x340
    LvtLint0           = 0x350
    LvtLint1           = 0x360
    LvtError           = 0x370
    TimerInitialCount  = 0x380  # ◄──┐
    TimerCurrentCount  = 0x390  #    ├── Timer Config Registers
    TimerDivideConfig  = 0x3e0  # ◄──┘

proc readRegister(offset: LapicOffset): uint32 {.inline.} =
  result = cast[ptr uint32](apicBaseAddress + offset.uint16)[]

proc writeRegister(offset: LapicOffset, value: uint32) {.inline.} =
  cast[ptr uint32](apicBaseAddress + offset.uint16)[] = value
```

## Initializing the APIC

There are two places that control whether the APIC is enabled or not: the
`IA32_APIC_BASE` MSR APIC global enable/disable flag (bit 11), and the APIC software
enable/disable flag in the spurious-interrupt vector register.

::: note

Spurious interrupts can occur in rare situations when the processor receives an interrupt
at a lower priority than the current interrupt being processed, causing it to become
pending. While the ISR for the current interrupt is executing, it may mask the pending
interrupt. The APIC will then deliver a spurious interrupt to the processor, which will
cause the processor to execute the ISR configured for spurious interrupts. In this case
the spurious interrupt handler should just ignore the interrupt and return without an EOI.
:::

The APIC global enable/disable flag is enabled by default, so we don't need to worry about
it. This is not the case for the enable/disable bit in the spurious-interrupt vector
register, so we need to set it to enable the APIC. Let's first look at a diagram of the
spurious-interrupt vector register.

```
                       Spurious Interrupt Vector Register
 
 31                                               12 11 10  9  8 7             0
┌────────────────────────────────────────────────┬──┬─────┬──┬──┬───────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │░░░░░│  │  │               │
└────────────────────────────────────────────────┴──┴─────┴──┴──┴───────────────┘
                                                  ▲         ▲  ▲       ▲
                 EOI Broadcast Suppression ───────┘         │  │       │
                  Focus Processor Checking ─────────────────┘  │       │
              APIC Software Enable/Disable ────────────────────┘       │
                 Spurious Interrupt Vector ────────────────────────────┘
```

The bits we are interested in are the APIC software enable/disable bit (bit 8) and the
spurious interrupt vector (bits 7-0). The vector is set to `0xFF` by default, which we
will keep as is, and will add a new interrupt handler for. Let's create type for the
spurious interrupt vector register so we can easily access its fields.

```nim
type
  SpuriousInterruptVectorRegister {.packed.} = object
    vector                  {.bitsize:  8.}: uint32
    apicEnabled             {.bitsize:  1.}: uint32
    focusProcessorChecking  {.bitsize:  1.}: uint32
    reserved0               {.bitsize:  2.}: uint32
    eoiBroadcastSuppression {.bitsize:  1.}: uint32
    reserved1               {.bitsize: 19.}: uint32
```

Let's create the spurious interrupt handler, which ignores those interrupts.

```nim
import idt
...

proc spuriousInterruptHandler*(frame: ptr InterruptFrame)
  {.cdecl, codegenDecl: "__attribute__ ((interrupt)) $# $#$#".} =
  # Ignore spurious interrupts; do not send an EOI
  return
```

Now let's create a proc to initialize the APIC. This proc will first call
`initBaseAddress` to initialize the base address of the APIC, write the spurious interrupt
vector register to enable the APIC, and finally install the spurious interrupt handler in
the IDT.

```nim
proc lapicInit*() =
  initBaseAddress()
  # enable APIC
  let sivr = SpuriousInterruptVectorRegister(vector: 0xff, apicEnabled: 1)
  writeRegister(LapicOffset.SpuriousInterrupt, cast[uint32](sivr))
  # install spurious interrupt handler
  installHandler(0xff, spuriousInterruptHandler)
```

Finally, we need to call `lapicInit` from the kernel's `main` proc to initialize the APIC.

```nim{3,12-13}
# src/kernel/main.nim

import lapic
...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  logger.info "init idt"
  idtInit()

  logger.info "init lapic"
  lapicInit()
  ...
```

The Local APIC should now be initialized and ready to receive interrupts. In the next
section, we'll look at how to program the Local APIC timer to generate periodic
interrupts.