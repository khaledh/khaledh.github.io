# Higher Half Kernel

The kernel is currently linked at address `0x100000`, not at the higher half of the address space. The UEFI environment does have paging enabled, but we need to build our own page tables, and map the kernel at the higher half of the address space. This needs to be done in the bootloader, before we jump to the kernel (since we'll change the kernel to be linked at the higher half). Once we're in the kernel, we can set up different page tables that fit our needs.

## Linking the kernel

To link the kernel at the higher half of the address space, we need to change the base address of the kernel in the linker script. However, instead of linking the kernel at exactly `0xFFFF800000000000`, we'll link it at 1 MiB above that address, i.e. `0xFFFF800000100000`. This will make virtual addresses and physical addresses line up nicely, and we can compare them visually by just looking at least significant bytes of the address, which makes debugging page table mappings easier.

```ld{5}
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0xFFFF800000100000;
  .text   : {
    *main*.o(.*text.KernelMain)
    *main*.o(.*text.*)
    *(.*text*)
  }
  .rodata : { *(.*rodata*) }
  .data   : { *(.*data) *(.*bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

If we try to compile and link the kernel, we'll get a bunch of relocation errors:

```sh-session
$ just kernel
ld.lld: error: .../fusion/build/@mmain.nim.c.o:(function KernelMainInner__main_u7: .text.KernelMainInner__main_u7+0x232): relocation R_X86_64_32S out of range: -140737488267184 is not in [-2147483648, 2147483647]; references section '.rodata'
>>> referenced by @mmain.nim.c
...
```

The problem here is that the compiler has something called a "code model", which determines how it generates code. The default code model is `small`, which means that the compiler assumes that the code and data are linked in the lower 2 GiB of the address space. What we need here is the `large` code model, which assumes that the code and data are linked anywhere in the address space. We can specify the code model using the `-mcmodel` flag, so let's add it to the kernel's `nim.cfg` file.

```properties
# src/kernel/nim.cfg
...

--passc:"-mcmodel=large"
```

Now the kernel should compile and link successfully. Let's take a quick look at the linker map.

```sh-session
$ head -n 10 build/kernel.map
             VMA              LMA     Size Align Out     In      Symbol
               0                0 ffff800000100000     1 . = 0xFFFF800000100000
ffff800000100000 ffff800000100000    2048c    16 .text
ffff800000100000 ffff800000100000      1ee    16         .../fusion/build/@mmain.nim.c.o:(.ltext.KernelMain)
ffff800000100000 ffff800000100000      1ee     1                 KernelMain
ffff8000001001f0 ffff8000001001f0     261f    16         .../fusion/build/@mmain.nim.c.o:(.ltext.KernelMainInner__main_u13)
ffff8000001001f0 ffff8000001001f0     261f     1                 KernelMainInner__main_u13
ffff800000102810 ffff800000102810       9b    16         .../fusion/build/@mmain.nim.c.o:(.ltext.nimFrame)
ffff800000102810 ffff800000102810       9b     1                 nimFrame
ffff8000001028b0 ffff8000001028b0       25    16         .../fusion/build/@mmain.nim.c.o:(.ltext.nimErrorFlag)
```

Looks good. Before we start setting up paging, let's add a few utility procs to prepare the `BootInfo` structure with the physical memory map and the virtual memory map.

## Preparing BootInfo

We need to pass a few things to the kernel, including:

- The physical memory map
- The virtual memory map
- The virtual address where physical memory is mapped

We already have a `convertUefiMemoryMap` proc that converts the UEFI memory map to our own format. Let's add a proc to create a virtual memory map as well, which will contain the virtual address space regions that we'll map.

```nim
# src/boot/bootx64.nim
...

const
  KernelPhysicalBase = 0x10_0000'u64
  KernelVirtualBase = 0xFFFF_8000_0000_0000'u64 + KernelPhysicalBase

  KernelStackVirtualBase = 0xFFFF_8001_0000_0000'u64 # KernelVirtualBase + 4 GiB
  KernelStackSize = 16 * 1024'u64
  KernelStackPages = KernelStackSize div PageSize

  BootInfoVirtualBase = KernelStackVirtualBase + KernelStackSize # after kernel stack

  PhysicalMemoryVirtualBase = 0xFFFF_8002_0000_0000'u64 # KernelVirtualBase + 8 GiB

...

proc createVirtualMemoryMap(
  kernelImagePages: uint64,
  physMemoryPages: uint64,
): seq[MemoryMapEntry] =

  result.add(MemoryMapEntry(
    type: KernelCode,
    start: KernelVirtualBase,
    nframes: kernelImagePages
  ))
  result.add(MemoryMapEntry(
    type: KernelStack,
    start: KernelStackVirtualBase,
    nframes: KernelStackPages
  ))
  result.add(MemoryMapEntry(
    type: KernelData,
    start: BootInfoVirtualBase,
    nframes: 1
  ))
  result.add(MemoryMapEntry(
    type: KernelData,
    start: PhysicalMemoryVirtualBase,
    nframes: physMemoryPages
  ))
```

Now, let's add a proc to prepare the `BootInfo` structure itself.

```nim
# src/boot/bootx64.nim
...

proc createBootInfo(
  bootInfoBase: uint64,
  kernelImagePages: uint64,
  physMemoryPages: uint64,
  physMemoryMap: seq[MemoryMapEntry],
  virtMemoryMap: seq[MemoryMapEntry],
): ptr BootInfo =
  var bootInfo = cast[ptr BootInfo](bootInfoBase)
  bootInfo.physicalMemoryVirtualBase = PhysicalMemoryVirtualBase

  # copy physical memory map entries to boot info
  bootInfo.physicalMemoryMap.len = physMemoryMap.len.uint
  bootInfo.physicalMemoryMap.entries =
    cast[ptr UncheckedArray[MemoryMapEntry]](bootInfoBase + sizeof(BootInfo).uint64)
  for i in 0 ..< physMemoryMap.len:
    bootInfo.physicalMemoryMap.entries[i] = physMemoryMap[i]
  let physMemoryMapSize = physMemoryMap.len.uint64 * sizeof(MemoryMapEntry).uint64

  # copy virtual memory map entries to boot info
  bootInfo.virtualMemoryMap.len = virtMemoryMap.len.uint
  bootInfo.virtualMemoryMap.entries =
    cast[ptr UncheckedArray[MemoryMapEntry]](bootInfoBase + sizeof(BootInfo).uint64 + physMemoryMapSize)
  for i in 0 ..< virtMemoryMap.len:
    bootInfo.virtualMemoryMap.entries[i] = virtMemoryMap[i]
  
  result = bootInfo
```

Finally, we'll call these procs from `EfiMainInner`. We'll also get the `maxPhysAddr` (which is the highest usable physical address) and use it to calculate the number of physical memory pages.

```nim
# src/boot/bootx64.nim
...

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # ======= NO MORE UEFI BOOT SERVICES =======

  let physMemoryMap = convertUefiMemoryMap(memoryMap, memoryMapSize, memoryMapDescriptorSize)

  # get max free physical memory address
  var maxPhysAddr: PhysAddr
  for i in 0 ..< physMemoryMap.len:
    if physMemoryMap[i].type == Free:
      maxPhysAddr = physMemoryMap[i].start.PhysAddr +! physMemoryMap[i].nframes * PageSize

  let physMemoryPages: uint64 = maxPhysAddr.uint64 div PageSize

  let virtMemoryMap = createVirtualMemoryMap(kernelImagePages, physMemoryPages)

  debugln &"boot: Preparing BootInfo"
  let bootInfo = createBootInfo(
    bootInfoBase,
    kernelImagePages,
    physMemoryPages,
    physMemoryMap,
    virtMemoryMap,
  )
```

## Bootloader paging setup

We know we need to map the kernel to the higher half. But since we're going to be changing the paging structures in the bootloader, we'll need to identity-map the bootloader image itself. The reason is that the bootloader code is currently running from the bootloader image, which is mapped to the lower half of the address space. If we change the page tables, the bootloader code will no longer be accessible, and we'll get a page fault. Here's a list of things we need to map:

- The bootloader image (identity-mapped)
- The boot info structure
- The kernel image
- The kernel stack
- All physical memory

We'll create a new page table structure and map all of the above regions (including physical memory), and install it before jumping to the kernel. Let's create a new proc to do the mapping.

```nim
# src/boot/bootx64.nim
...
import kernel/pmm
import kernel/vmm
...

type
  AlignedPage = object
    data {.align(PageSize).}: array[PageSize, uint8]

proc createPageTable(
  bootloaderBase: uint64,
  bootloaderPages: uint64,
  kernelImageBase: uint64,
  kernelImagePages: uint64,
  kernelStackBase: uint64,
  kernelStackPages: uint64,
  bootInfoBase: uint64,
  bootInfoPages: uint64,
  physMemoryPages: uint64,
): ptr PML4Table =

  proc bootAlloc(nframes: uint64): Option[PhysAddr] =
    result = some(cast[PhysAddr](new AlignedPage))

  # initialize vmm using identity-mapped physical memory
  vmInit(physMemoryVirtualBase = 0'u64, physAlloc = bootAlloc)

  debugln &"boot: Creating new page tables"
  var pml4 = cast[ptr PML4Table](bootAlloc(1).get)

  # identity-map bootloader image
  debugln &"""boot:   {"Identity-mapping bootloader\:":<30} base={bootloaderBase:#010x}, pages={bootloaderPages}"""
  identityMapRegion(pml4, bootloaderBase.PhysAddr, bootloaderPages.uint64, paReadWrite, pmSupervisor)

  # identity-map boot info
  debugln &"""boot:   {"Identity-mapping BootInfo\:":<30} base={bootInfoBase:#010x}, pages={bootInfoPages}"""
  identityMapRegion(pml4, bootInfoBase.PhysAddr, bootInfoPages, paReadWrite, pmSupervisor)

  # map kernel to higher half
  debugln &"""boot:   {"Mapping kernel to higher half\:":<30} base={KernelVirtualBase:#010x}, pages={kernelImagePages}"""
  mapRegion(pml4, KernelVirtualBase.VirtAddr, kernelImageBase.PhysAddr, kernelImagePages, paReadWrite, pmSupervisor)

  # map kernel stack
  debugln &"""boot:   {"Mapping kernel stack\:":<30} base={KernelStackVirtualBase:#010x}, pages={kernelStackPages}"""
  mapRegion(pml4, KernelStackVirtualBase.VirtAddr, kernelStackBase.PhysAddr, kernelStackPages, paReadWrite, pmSupervisor)

  # map all physical memory; assume 128 MiB of physical memory
  debugln &"""boot:   {"Mapping physical memory\:":<30} base={PhysicalMemoryVirtualBase:#010x}, pages={physMemoryPages}"""
  mapRegion(pml4, PhysicalMemoryVirtualBase.VirtAddr, 0.PhysAddr, physMemoryPages, paReadWrite, pmSupervisor)

  result = pml4
```

Notice the `AlignedPage` type and the inner proc`bootAlloc`. This is a temporary proc that we'll use to allow the VMM to allocate physical memory for the page tables (the pages must be aligned to 4 KiB, hence the `AlignedPage` type). It works because the UEFI environment is identity-mapped, so allocating using the `new` operator will return an address of a page that we can use for the page tables. In the kernel, we'll rely on the physical memory manager to allocate physical memory for the page tables.

Now, let's put everything together in `EfiMainInner`. Notice that we added an assembly instruction to load the new page tables into the `cr3` register. This is the register that holds the physical address of the PML4 table.

```nim
# src/boot/bootx64.nim
...

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  let physMemoryMap = convertUefiMemoryMap(memoryMap, memoryMapSize, memoryMapDescriptorSize)

  # get max free physical memory address
  var maxPhysAddr: PhysAddr
  for i in 0 ..< physMemoryMap.len:
    if physMemoryMap[i].type == Free:
      maxPhysAddr = physMemoryMap[i].start.PhysAddr +! physMemoryMap[i].nframes * PageSize

  let physMemoryPages: uint64 = maxPhysAddr.uint64 div PageSize

  let virtMemoryMap = createVirtualMemoryMap(kernelImagePages, physMemoryPages)

  debugln &"boot: Preparing BootInfo"
  let bootInfo = createBootInfo(
    bootInfoBase,
    kernelImagePages,
    physMemoryPages,
    physMemoryMap,
    virtMemoryMap,
  )

  let bootloaderPages = (loadedImage.imageSize.uint + 0xFFF) div 0x1000.uint

  let pml4 = createPageTable(
    cast[uint64](loadedImage.imageBase),
    bootloaderPages,
    cast[uint64](kernelImageBase),
    kernelImagePages,
    kernelStackBase,
    kernelStackPages,
    bootInfoBase,
    1, # bootInfoPages
    physMemoryPages,
  )

  # jump to kernel
  let kernelStackTop = KernelStackVirtualBase + KernelStackSize
  let cr3 = cast[uint64](pml4)
  debugln &"boot: Jumping to kernel at {cast[uint64](KernelVirtualBase):#010x}"
  asm """
    mov rdi, %0  # bootInfo
    mov cr3, %2  # PML4
    mov rsp, %1  # kernel stack top
    jmp %3       # kernel entry point
    :
    : "r"(`bootInfoBase`),
      "r"(`kernelStackTop`),
      "r"(`cr3`),
      "r"(`KernelVirtualBase`)
  """

  # we should never get here
  quit()
```

## Initializing the PMM and VMM

Now that physical memory is not identity-mapped anymore, we need to update the PMM to know about the new virtual address of physical memory. To access a `PMNode` as a physical address, we subtract the physical memory virtual base address from the pointer. To access a physical address as a `PMNode`, we add the physical memory virtual base address to the address.

```nim{6,9-10,14,17}
# src/kernel/pmm.nim

var
  head: ptr PMNode
  maxPhysAddr: PhysAddr # exclusive
  physicalMemoryVirtualBase: uint64
  reservedRegions: seq[PMRegion]

proc pmInit*(physMemoryVirtualBase: uint64, memoryMap: MemoryMap) =
  physicalMemoryVirtualBase = physMemoryVirtualBase
  ...

proc toPhysAddr(p: ptr PMNode): PhysAddr {.inline.} =
  result = PhysAddr(cast[uint64](p) - physicalMemoryVirtualBase)

proc toPMNodePtr(p: PhysAddr): ptr PMNode {.inline.} =
  result = cast[ptr PMNode](cast[uint64](p) + physicalMemoryVirtualBase)
```

The VMM already takes a parameter for the physical memory virtual base (in the bootloader we set it to `0`, since physical memory is identity-mapped there). We just need to pass it from the kernel. Let's initialize both the PMM and the VMM with this parameter.

```nim{7-13}
# src/kernel/main.nim

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  debug "kernel: Initializing physical memory manager "
  pmInit(bootInfo.physicalMemoryVirtualBase, bootInfo.physicalMemoryMap)
  debugln "[success]"

  debug "kernel: Initializing virtual memory manager "
  vmInit(bootInfo.physicalMemoryVirtualBase, pmm.pmAlloc)
  debugln "[success]"
```

Let's try to compile and run the kernel. We should see the following output:

```sh-session
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Initializing virtual memory manager [success]
```

Looks good.

## Print memory maps

Let's add a couple of procs to print the physical and virtual memory maps.

```nim{4-32,48-52}
# src/kernel/main.nim
...

proc printFreeRegions() =
  debug &"""   {"Start":>16}"""
  debug &"""   {"Start (KB)":>12}"""
  debug &"""   {"Size (KB)":>11}"""
  debug &"""   {"#Pages":>9}"""
  debugln ""
  var totalFreePages: uint64 = 0
  for (start, nframes) in pmFreeRegions():
    debug &"   {cast[uint64](start):>#16x}"
    debug &"   {cast[uint64](start) div 1024:>#12}"
    debug &"   {nframes * 4:>#11}"
    debug &"   {nframes:>#9}"
    debugln ""
    totalFreePages += nframes
  debugln &"kernel: Total free: {totalFreePages * 4} KiB ({totalFreePages * 4 div 1024} MiB)"

proc printVMRegions(memoryMap: MemoryMap) =
  debug &"""   {"Start":>20}"""
  debug &"""   {"Type":12}"""
  debug &"""   {"VM Size (KB)":>12}"""
  debug &"""   {"#Pages":>9}"""
  debugln ""
  for i in 0 ..< memoryMap.len:
    let entry = memoryMap.entries[i]
    debug &"   {entry.start:>#20x}"
    debug &"   {entry.type:#12}"
    debug &"   {entry.nframes * 4:>#12}"
    debug &"   {entry.nframes:>#9}"
    debugln ""

...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  debug "kernel: Initializing physical memory manager "
  pmInit(bootInfo.physicalMemoryVirtualBase, bootInfo.physicalMemoryMap)
  debugln "[success]"

  debug "kernel: Initializing virtual memory manager "
  vmInit(bootInfo.physicalMemoryVirtualBase, pmm.pmAlloc)
  debugln "[success]"

  debugln "kernel: Physical memory free regions "
  printFreeRegions()

  debugln "kernel: Virtual memory regions "
  printVMRegions(bootInfo.virtualMemoryMap)
  ...
```

Let's compile and run the kernel. If everything goes well, we should see the following output:

```sh-session
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Initializing virtual memory manager [success]
kernel: Physical memory free regions
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x222000           2184          6008        1502
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         90276       22569
          0x6235000         100564          1248         312
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 123224 KiB (120 MiB)
kernel: Virtual memory regions
                  Start   Type           VM Size (KB)      #Pages
     0xffff800000100000   KernelCode             1160         290
     0xffff800100000000   KernelStack              16           4
     0xffff800100004000   KernelData                4           1
     0xffff800200000000   KernelData           130000       32500
```

Great! Our kernel is now running at the higher half of the address space. This is another big milestone.

There are many things we can tackle next, but one important thing we need to take care of before we add more code is handling CPU exceptions. The reason is that sooner or later our kernel will crash, and we won't know why. Handling CPU exceptions gives us a way to print a debug message and halt the CPU, so we can see what went wrong.

But before we can do that, we need to set up the **Global Descriptor Table** (GDT), which we'll look at in the next section.
