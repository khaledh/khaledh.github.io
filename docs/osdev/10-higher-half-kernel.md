# Higher Half Kernel

We could spend a lot of time planning the kernel. An operating system is a complex piece of software, and it's easy to get lost in the details. I think it's best to start with a minimal kernel, and then add features as we go. This way, we can focus on the essentials, and we can always refactor later. There are, however, some design decisions that I know I want to make from the start.

One of the important decisions is how to manage the virtual address space. We can't keep using physical memory directly; sooner or later we'll run out of it. We're already using virtual memory in the UEFI bootloader, but it has been identity-mapped to physical memory by the UEFI firmware. So we'll need to decide on how we're going to lay out the virtual address space, and how we're going to manage it.

## Virtual address space

The 64-bit virtual address space on x86_64 uses a canonical address format, where the most significant 16 bits of the 64-bit address must be either all 0s or all 1s. This means that the address space is split into two halves: the lower half (from `0x0000000000000000` to `0x00007FFFFFFFFFFF`), and the higher half (from `0xFFFF800000000000` to `0xFFFFFFFFFFFFFFFF`). Each is 48 bits in size, which is equivalent to 256 TB. This is more than enough for our purposes. We'll use the lower half (128 TB) for user processes, and the higher half (128 TB) for the kernel.

That being said, we have a problem. The kernel is currently linked at address `0x100000`, not at the higher half of the address space. The UEFI environment does have paging enabled, but we need to build our own page tables, and map the kernel at the higher half of the address space. This needs to be done in the bootloader, before we jump to the kernel (since we'll change the kernel to be linked at the higher half). Once we're in the kernel, we can set up different page tables that fit our needs (although we'll still need to map the kernel at the higher half of the address space).

## Linking the kernel

To link the kernel at the higher half of the address space, we need to change the base address of the kernel in the linker script. This should be a straightforward change.

```ld{5}
/* src/kernel/kernel.ld */

SECTIONS
{
  . = 0xFFFF800000000000;
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
ld.lld: error: /Users/khaledhammouda/src/github.com/khaledh/fusion/build/@mmain.nim.c.o:(function KernelMainInner__main_u7: .text.KernelMainInner__main_u7+0x232): relocation R_X86_64_32S out of range: -140737488267184 is not in [-2147483648, 2147483647]; references section '.rodata'
>>> referenced by @mmain.nim.c
...
```

The problem here is that the compiler has something called a "code model", which determines how it generates code. The default code model is `small`, which means that the compiler assumes that the code and data are linked in the lower 2 GB of the address space. What we need here is the `large` code model, which assumes that the code and data are linked anywhere in the address space. We can specify the code model using the `-mcmodel` flag, so let's add it to the kernel's `nim.cfg` file.

```properties
# src/kernel/nim.cfg
...

--passc:"-mcmodel=large"
```

Now the kernel should compile and link successfully. Let's take a quick look at the linker map.

```sh-session
$ head -n 10 build/kernel.map
             VMA              LMA     Size Align Out     In      Symbol
               0                0 ffff800000000000     1 . = 0xFFFF800000000000
ffff800000000000 ffff800000000000    15f6c    16 .text
ffff800000000000 ffff800000000000      1ee    16         .../fusion/build/@mmain.nim.c.o:(.ltext.KernelMain)
ffff800000000000 ffff800000000000      1ee     1                 KernelMain
ffff8000000001f0 ffff8000000001f0     1f5e    16         .../fusion/build/@mmain.nim.c.o:(.ltext.KernelMainInner__main_u7)
ffff8000000001f0 ffff8000000001f0     1f5e     1                 KernelMainInner__main_u7
ffff800000002150 ffff800000002150       9b    16         .../fusion/build/@mmain.nim.c.o:(.ltext.nimFrame)
ffff800000002150 ffff800000002150       9b     1                 nimFrame
ffff8000000021f0 ffff8000000021f0       20    16         .../fusion/build/@mmain.nim.c.o:(.ltext.nimErrorFlag)
```

Looks good. Next, we'll look at how to set up paging in the bootloader.

## Page tables structure

In x64 mode, page tables are used to translate virtual addresses to physical addresses. They are structured as a tree.

- The root of the tree is a **Page Map Level 4** table (PML4), which contains 512 entries.
- Each entry points to a **Page Directory Pointer Table** (PDPT), which also contains 512 entries.
- Each entry in the PDPT points to a **Page Directory** (PD), which contains 512 entries.
- Each entry in the PD points to a **Page Table** (PT), which contains 512 entries.
- Each entry in the PT points to a physical page frame. The page frame size is 4 KB of physical memory.

The page tables are stored in memory, and the physical address of the root of the tree (the PML4 table) is stored in the `CR3` control register. The virtual address is split into 5 parts:

- Bits 48-63: Unused (16 bits)
  - These are sign-extended from bit 47, and indicate whether the address is in the lower half (bit 47 is `0`) or the higher half (bit 47 is `1`) of the address space.
- Bits 39-47: Index into the PML4 (9 bits)
- Bits 30-38: Index into the PDPT (9 bits)
- Bits 21-29: Index into the PD (9 bits)
- Bits 12-20: Index into the PT (9 bits)
- Bits 0-11: Offset within the physical page frame (12 bits)

Here's a diagram of a virtual address, and how each section of the address maps to the paging tables:

```text
┌──────────────────┬────────────────┬────────────────┬──────────────┬──────────────┬─────────────┐
│      63:49       │      48:39     │      38:30     │     29:21    │     20:12    │     11:0    │
├──────────────────┼────────────────┼────────────────┼──────────────┼──────────────┼─────────────┤
│ Unused (16 bits) │ PML4 index (9) │ PDPT index (9) │ PD index (9) │ PT index (9) │ Offset (12) │
└──────────────────┴────────────────┴────────────────┴──────────────┴──────────────┴─────────────┘
```

So in order to link the kernel at the start of the higher half of the address space (`0xFFFF800000000000`), we need to map the virtual pages at `0xFFFF800000000000` to `0xFFFF800000000000 + (kernel size)` to the physical pages at `0x100000` to `0x100000 + (kernel size)`. We'll need to create a PML4 table, a PDPT, a PD, and a PT, and fill them with the appropriate entries.

Let's break down the higher half address `0xFFFF800000000000` according to the above diagram:

- Bits 63:49: `0xFFFF` (sign-extended from bit 47)
- Bits 48:39: `0x100` (index 256 in the PML4 table)
- Bits 38:30: `0x000` (index 0 in the PDP table)
- Bits 29:21: `0x000` (index 0 in the PD table)
- Bits 20:12: `0x000` (index 0 in the PT table)

To map this virtual address to physical address `0x100000`, we need to set the following entries:

- PML4Table: PML4Entry at index 256 points to PDPTable
- PDPTable: PDPTEntry at index 0 points to PDTable
- PDTable: PDEntry at index 0 points to PTable
- PTable: PTEntry at index 0 points to physical address `0x100000`

Here's a diagram of the page tables after we've set the entries:

```text
┌─────────────────┐  ┌──>┌─────────────────┐  ┌──>┌─────────────────┐  ┌──>┌─────────────────┐
│ PML4Table       │  │   │ PDPTable        │  │   │ PDTable         │  │   │ PTable          │
├─────────────────┤  │   ├─────────────────┤  │   ├─────────────────┤  │   ├─────────────────┤
│ PML4Entry 0     │  │   │ PDPTEntry 0     │──┘   │ PDEntry 0       │──┘   │ PTEntry 0       │──> 0x100000
│ PML4Entry 1     │  │   │ PDPTEntry 1     │      │ PDEntry 1       │      │ PTEntry 1       │
│ ...             │  │   │                 │      │                 │      │                 │
│ PML4Entry 256   │──┘   │ ...             │      │ ...             │      │ ...             │
│ ...             │      │                 │      │                 │      │                 │
│ PML4Entry 511   │      │ PDPTEntry 511   │      │ PDEntry 511     │      │ PTEntry 511     │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Implementing page tables

Let's start by defining the structures for 4-level paging. Since we're going to need this both in the bootloader and in the kernel, we'll put it in a common module under `common/pagetables.nim`. One important point that we need to keep in mind is that the page tables need to be aligned on a 4 KB boundary. We'll use Nim's `align` pragma to do this.


```nim
# src/common/pagetables.nim

const
  PageSize* = 4096

type
  # Page Map Level 4 Entry
  PML4Entry* {.packed.} = object
    present* {.bitsize: 1.}: uint64      # bit      0
    write* {.bitsize: 1.}: uint64        # bit      1
    user* {.bitsize: 1.}: uint64         # bit      2
    writeThrough* {.bitsize: 1.}: uint64 # bit      3
    cacheDisable* {.bitsize: 1.}: uint64 # bit      4
    accessed* {.bitsize: 1.}: uint64     # bit      5
    ignored1* {.bitsize: 1.}: uint64     # bit      6
    reserved1* {.bitsize: 1.}: uint64    # bit      7
    ignored2* {.bitsize: 4.}: uint64     # bits 11: 8
    physAddress* {.bitsize: 28.}: uint64 # bits 51:12
    ignored3* {.bitsize: 11.}: uint64    # bits 62:52
    xd* {.bitsize: 1.}: uint64           # bit     63

  # Page Directory Pointer Table Entry
  PDPTEntry* {.packed.} = object
    present* {.bitsize: 1.}: uint64      # bit      0
    write* {.bitsize: 1.}: uint64        # bit      1
    user* {.bitsize: 1.}: uint64         # bit      2
    writeThrough* {.bitsize: 1.}: uint64 # bit      3
    cacheDisable* {.bitsize: 1.}: uint64 # bit      4
    accessed* {.bitsize: 1.}: uint64     # bit      5
    ignored1* {.bitsize: 1.}: uint64     # bit      6
    pageSize* {.bitsize: 1.}: uint64     # bit      7
    ignored2* {.bitsize: 4.}: uint64     # bits 11: 8
    physAddress* {.bitsize: 28.}: uint64 # bits 51:12
    ignored3* {.bitsize: 11.}: uint64    # bits 62:52
    xd* {.bitsize: 1.}: uint64           # bit     63

  # Page Directory Entry
  PDEntry* {.packed.} = object
    present* {.bitsize: 1.}: uint64      # bit      0
    write* {.bitsize: 1.}: uint64        # bit      1
    user* {.bitsize: 1.}: uint64         # bit      2
    writeThrough* {.bitsize: 1.}: uint64 # bit      3
    cacheDisable* {.bitsize: 1.}: uint64 # bit      4
    accessed* {.bitsize: 1.}: uint64     # bit      5
    ignored1* {.bitsize: 1.}: uint64     # bit      6
    pageSize* {.bitsize: 1.}: uint64     # bit      7
    ignored2* {.bitsize: 4.}: uint64     # bits 11: 8
    physAddress* {.bitsize: 28.}: uint64 # bits 51:12
    ignored3* {.bitsize: 11.}: uint64    # bits 62:52
    xd* {.bitsize: 1.}: uint64           # bit     63

  # Page Table Entry
  PTEntry* {.packed.} = object
    present* {.bitsize: 1.}: uint64      # bit      0
    write* {.bitsize: 1.}: uint64        # bit      1
    user* {.bitsize: 1.}: uint64         # bit      2
    writeThrough* {.bitsize: 1.}: uint64 # bit      3
    cacheDisable* {.bitsize: 1.}: uint64 # bit      4
    accessed* {.bitsize: 1.}: uint64     # bit      5
    dirty* {.bitsize: 1.}: uint64        # bit      6
    pat* {.bitsize: 1.}: uint64          # bit      7
    global* {.bitsize: 1.}: uint64       # bit      8
    ignored1* {.bitsize: 3.}: uint64     # bits 11: 9
    physAddress* {.bitsize: 28.}: uint64 # bits 51:12
    ignored2* {.bitsize: 11.}: uint64    # bits 62:52
    xd* {.bitsize: 1.}: uint64           # bit     63

  # Page Map Level 4 Table
  PML4Table* = ref object
    entries* {.align(PageSize).}: array[512, PML4Entry]

  # Page Directory Pointer Table
  PDPTable* = ref object
    entries* {.align(PageSize).}: array[512, PDPTEntry]

  # Page Directory
  PDTable* = ref object
    entries* {.align(PageSize).}: array[512, PDEntry]

  # Page Table
  PTable* = ref object
    entries* {.align(PageSize).}: array[512, PTEntry]

  PageAccess* = enum
    paRead = 0
    paReadWrite = 1

  PageMode* = enum
    pmSupervisor = 0
    pmUser = 1
```

::: tip Note
Ideally we wouldn't need to define an `entries` array field within each object, and we could just define the tables like so:
  
  ```nim
  PML4Array* {.align(PageSize).} = array[512, PML4Entry]
  PML4Table* = ref PML4Array
  ```

Then we could access the table by indexing directly into its variable, e.g. `pml4[i]`, instead of `pml4.entries[i]`. Unfortunately Nim doesn't support type-level alginment (yet). See this [RFC](https://github.com/nim-lang/RFCs/issues/545).
:::

## Mapping pages

With the page tables structures defined, we can now write a function to map a virtual page to a physical page. We'll extract 4 index values from the virtual address, and use them to insert (or update) the appropriate entries in the page tables. Remember that we'll need to store physical addresses at each level of the page tables, which is easy to do in the bootloader, since the physical memory is identity-mapped by the UEFI firmware. In the kernel, however, we'll need to find another way to get the physical address of paging structures that will be allocated using virtual addresses (we'll see how to do this later).

Let's create a `src/boot/paging.nim` module and add a `mapPages` proc.

```nim
# src/boot/paging.nim

import common/pagetables

proc mapPage*(
  pml4: PML4Table,
  virtAddr: uint64,
  physAddr: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode
) =
  var pml4Index = (virtAddr shr 39) and 0x1FF
  var pdptIndex = (virtAddr shr 30) and 0x1FF
  var pdIndex = (virtAddr shr 21) and 0x1FF
  var ptIndex = (virtAddr shr 12) and 0x1FF

  let access = cast[uint64](pageAccess)
  let mode = cast[uint64](pageMode)

  var pdpt: PDPTable
  var pd: PDTable
  var pt: PTable

  # Page Map Level 4 Table
  if pml4.entries[pml4Index].present == 1:
    pdpt = cast[PDPTable](cast[uint64](pml4.entries[pml4Index].physAddress) shl 12)
  else:
    pdpt = new PDPTable
    pml4.entries[pml4Index].physAddress = cast[uint64](pdpt.entries.addr) shr 12
    pml4.entries[pml4Index].write = access
    pml4.entries[pml4Index].user = mode
    pml4.entries[pml4Index].present = 1

  # Page Directory Pointer Table
  if pdpt.entries[pdptIndex].present == 1:
    pd = cast[PDTable](cast[uint64](pdpt.entries[pdptIndex].physAddress) shl 12)
  else:
    pd = new PDTable
    pdpt.entries[pdptIndex].physAddress = cast[uint64](pd.entries.addr) shr 12
    pdpt.entries[pdptIndex].write = access
    pdpt.entries[pdptIndex].user = mode
    pdpt.entries[pdptIndex].present = 1

  # Page Directory
  if pd.entries[pdIndex].present == 1:
    pt = cast[PTable](cast[uint64](pd.entries[pdIndex].physAddress) shl 12)
  else:
    pt = new PTable
    pd.entries[pdIndex].physAddress = cast[uint64](pt.entries.addr) shr 12
    pd.entries[pdIndex].write = access
    pd.entries[pdIndex].user = mode
    pd.entries[pdIndex].present = 1

  # Page Table
  pt.entries[ptIndex].physAddress = physAddr shr 12
  pt.entries[ptIndex].write = access
  pt.entries[ptIndex].user = mode
  pt.entries[ptIndex].present = 1
```

The caller needs to pass a `PML4Table` (the root of the page tables), which they are responsible for allocating. In addition to mapping a single page, we'll occasionally need to map a range of pages. We'll also need to identity-map pages in some cases. Let's add procs for these as well.

```nim
# src/boot/paging.nim

proc mapPages*(
  pml4: PML4Table,
  virtAddr: uint64,
  physAddr: uint64,
  pageCount: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode
) =
  for i in 0 ..< pageCount:
    mapPage(pml4, virtAddr + i * PageSize, physAddr + i * PageSize, pageAccess, pageMode)

proc identityMapPages*(
  pml4: PML4Table,
  physAddr: uint64,
  pageCount: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode
) =
  mapPages(pml4, physAddr, physAddr, pageCount, pageAccess, pageMode)
```

One more thing we need to do is install the page tables into the `CR3` control register to make them active. We'll add a proc to do this as well.

```nim
# src/boot/paging.nim
...

type
  CR3 = object
    ignored1 {.bitsize: 3.}: uint64 = 0
    writeThrough {.bitsize: 1.}: uint64 = 0
    cacheDisable {.bitsize: 1.}: uint64 = 0
    ignored2 {.bitsize: 7.}: uint64 = 0
    physAddress {.bitsize: 40.}: uint64
    ignored3 {.bitsize: 12.}: uint64 = 0

proc installPageTable*(pml4: PML4Table) =
  let cr3obj = CR3(physAddress: cast[uint64](pml4.entries.addr) shr 12)
  let cr3 = cast[uint64](cr3obj)
  asm """
    mov cr3, %0
    :
    : "r"(`cr3`)
  """
```

## Bootloader paging setup

We know we need to map the kernel to the higher half. But since we're going to be changing the paging structures in the bootloader, we'll need to identity-map the bootloader image itself. The reason is that the bootloader code is currently running from the bootloader image, which is mapped to the lower half of the address space. If we change the page tables, the bootloader code will no longer be accessible, and we'll get a page fault. Keep in mind also that the bootloader stack is also mapped to the lower half of the address space, so we'll need to identity-map that as well. So here's a list of things we need to map:

- The bootloader image (identity-mapped)
- The bootloader stack (identity-mapped)
- The memory map (identity-mapped)
- The kernel image (identity-mapped)
- The kernel image (mapped to the higher half)

> **Note**: Technically, we don't need to identity-map the kernel image, since it's linked at the higher half. But for some reason not doing so causes a reboot after jumping to the kernel. I'm not sure why this is happening, but identity-mapping the kernel image fixes the problem. I may come back to this later and try to figure out what's going on.

Most of the above mappings are easy, except for the bootloader stack (which will continue to be the kernel stack as we transfer control to it). There's no easy way in the UEFI environment to get the memory region allocated for the stack of the currently loaded image. So what we're going to do is manually get the current stack address, and scan the memory map to find the memory region that contains the stack. Let's add a proc do this.

```nim
# src/boot/bootx64.nim
...

proc getStackRegion(
  memoryMap: ptr EfiMemoryDescriptor,
  memoryMapSize: uint64,
  memoryMapDescriptorSize: uint64
): tuple[stackBase: uint64, stackPages: uint64] =
  # get stack pointer
  var rsp: uint64
  asm """
    mov %0, rsp
    :"=r"(`rsp`)
  """

  # scan memory map until we find the stack region
  var stackBase: uint64
  var stackPages: uint64
  let numMemoryMapEntries = memoryMapSize div memoryMapDescriptorSize
  for i in 0 ..< numMemoryMapEntries:
    let entry = cast[ptr EfiMemoryDescriptor](cast[uint64](memoryMap) + i * memoryMapDescriptorSize)
    if rsp > entry.physicalStart and rsp < entry.physicalStart + entry.numberOfPages * PageSize:
      stackBase = entry.physicalStart
      stackPages = entry.numberOfPages
      break

  return (stackBase, stackPages)
```

Now let's setup paging at the end of the `EfiMainInner` proc.

```nim{4-6,14-43}
# src/boot/bootx64.nim
...

const
  KernelPhysicalBase = 0x100000'u64
  KernelVirtualBase = 0xFFFF800000000000'u64


proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # ======= NO MORE UEFI BOOT SERVICES =======

  debugln "boot: Creating page table"
  # initialize a throw-away page table to map the kernel
  var pml4 = new PML4Table

  # identity-map bootloader image
  let bootloaderBase = cast[uint64](loadedImage.imageBase)
  let bootloaderPages = (loadedImage.imageSize.uint + 0xFFF) div 0x1000.uint
  debugln &"boot: Identity-mapping bootloader image: base={bootloaderBase:#x}, pages={bootloaderPages}"
  identityMapPages(pml4, bootloaderBase, bootloaderPages.uint64, paReadWrite, pmSupervisor)

  # identity-map bootloader stack
  let (stackBase, stackPages) = getStackRegion(memoryMap, memoryMapSize, memoryMapDescriptorSize)
  debugln &"boot: Identity-mapping stack: base={stackBase:#x}, pages={stackPages}"
  identityMapPages(pml4, stackBase, stackPages, paReadWrite, pmSupervisor)

  # identity-map memory map
  let memoryMapPages = (memoryMapSize + 0xFFF) div 0x1000.uint
  debugln &"boot: Identity-mapping memory map: base={cast[uint64](memoryMap):#x}, pages={memoryMapPages}"
  identityMapPages(pml4, cast[uint64](memoryMap), memoryMapPages, paReadWrite, pmSupervisor)

  # identity-map kernel
  debugln &"boot: Identity-mapping kernel: base={KernelPhysicalBase:#x}, pages={kernelPages}"
  identityMapPages(pml4, KernelPhysicalBase, kernelPages, paReadWrite, pmSupervisor)

  # map kernel to higher half
  debugln &"boot: Mapping kernel to higher half: base={KernelVirtualBase}, pages={kernelPages}"
  mapPages(pml4, KernelVirtualBase, KernelPhysicalBase, kernelPages, paReadWrite, pmSupervisor)

  debugln "boot: Installing page table"
  installPageTable(pml4)

  # jump to kernel
  debugln "boot: Jumping to kernel"
  var kernelMain = cast[KernelEntryPoint](KernelVirtualBase)
  kernelMain(memoryMap, memoryMapSize, memoryMapDescriptorSize)

  # we should never get here
  quit()
```

We should be good to go. Let's try it out.

![Kernel - Higher Half](kernel-higherhalf.png)

Great! We've entered the kernel, which is now running at the higher half of the address space.
