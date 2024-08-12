# Virtual Memory

So we have a working physical memory manager. But we can't keep using physical memory directly; sooner or later we'll run out of it. This is where virtual memory comes in. Virtual memory allows us to use more memory than we actually have, by mapping virtual addresses to physical addresses. In this section we'll implement a **Virtual Memory Manager** (VMM).

When we booted through UEFI, the firmware had already enabled virtual memory for us, but it has been identity-mapped to physical memory. This makes it easy to manage memory during the boot process, but to take advantage of virtual memory we need to set it up ourselves. Let's first take a look at how the x86-64 virtual memory system works.

## Virtual address space

The 64-bit virtual address space on x86-64 is 48 bits (or 57 bits if you enable the 5-level paging extension). Virtual addresses use a canonical address format, where the most significant 16 bits of the 64-bit address must be either all 0s or all 1s. This means that the address space is split into two parts: the lower half (from `0x0000000000000000` to `0x00007FFFFFFFFFFF`), and the higher half (from `0xFFFF800000000000` to `0xFFFFFFFFFFFFFFFF`). Each is 47 bits in size, which is equivalent to 128 TiB. This is more than enough for our purposes. We'll use the lower half (128 TiB) for user processes (**user space**), and the higher half (128 TiB) for the kernel (**kernel space**). This is a diagram of the virtual address space:

```text
  0xFFFFFFFFFFFFFFFF   (16 EiB) ┌──────────────────────────────┐
                                │         Kernel Space         │
  0xFFFF800000000000 (-128 TiB) ├──────────────────────────────┤
                                │                              │
                                │                              │
                                │      Canonical Address       │
                                │             Gap              │
                                │                              │
                                │                              │
  0x00007FFFFFFFFFFF  (128 TiB) ├──────────────────────────────┤
                                │         User Space           │
  0x0000000000000000    (0 TiB) └──────────────────────────────┘
```

We'll start by introducing some concepts about how address translaction works. The main idea is that the CPU makes us of a set of hierarchical page tables to translate virtual addresses to physical addresses. Let's take a look at the structure of these page tables.

## Page tables structure

In x64 mode, page tables are used to translate virtual addresses to physical addresses. They are structured as a tree.

- The root of the tree is a **Page Map Level 4** table (PML4), which contains 512 entries.
- Each entry points to a **Page Directory Pointer Table** (PDPT), which also contains 512 entries.
- Each entry in the PDPT points to a **Page Directory** (PD), which contains 512 entries.
- Each entry in the PD points to a **Page Table** (PT), which contains 512 entries.
- Each entry in the PT points to a physical page frame. The page frame size is 4 KiB of physical memory.

The page tables are stored in memory, and the physical address of the root of the tree (the PML4 table) is stored in the `CR3` control register. We can have different page tables at different times by changing the value of `CR3`. This is how we can switch between different address spaces.

The virtual address is split into 5 parts:

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

So in order to link the kernel at the start of the higher half of the address space (`0xFFFF800000100000`), we need to map the virtual pages at `0xFFFF800000100000` to `0xFFFF800000100000 + (kernel size)` to the physical pages at `0x100000` to `0x100000 + (kernel size)`. We'll need to create a PML4 table, a PDPT, a PD, and a PT, and fill them with the appropriate entries.

Let's break down the higher half address `0xFFFF800000100000` according to the above diagram:

- Bits 63:49: `0xFFFF` (sign-extended from bit 47)
- Bits 48:39: `0x100` (index 256 in the PML4 table)
- Bits 38:30: `0x000` (index 0 in the PDP table)
- Bits 29:21: `0x000` (index 0 in the PD table)
- Bits 20:12: `0x100` (index 256 in the PT table)
- Bits 11:0: `0x000` (offset 0 within the page frame)

To map this virtual address to physical address `0x100000`, we need to set the following entries:

- PML4Table: PML4Entry at index 256 points to PDPTable
- PDPTable: PDPTEntry at index 0 points to PDTable
- PDTable: PDEntry at index 0 points to PTable
- PTable: PTEntry at index 256 points to physical address `0x100000`

Here's a diagram of the page tables after we've set the entries:

```text
  ┌─────────────────┐  ┌──>┌─────────────────┐  ┌──>┌─────────────────┐  ┌──>┌─────────────────┐
  │ PML4Table       │  │   │ PDPTable        │  │   │ PDTable         │  │   │ PTable          │
  ├─────────────────┤  │   ├─────────────────┤  │   ├─────────────────┤  │   ├─────────────────┤
  │ PML4Entry 0     │  │  *│ PDPTEntry 0     │──┘  *│ PDEntry 0       │──┘   │ PTEntry 0       │
  │ PML4Entry 1     │  │   │ PDPTEntry 1     │      │ PDEntry 1       │      │ PTEntry 1       │
  │ ...             │  │   │                 │      │                 │      │ ...             │
 *│ PML4Entry 256   │──┘   │ ...             │      │ ...             │     *│ PTEntry 256     │──> 0x100000
  │ ...             │      │                 │      │                 │      │ ...             │
  │ PML4Entry 511   │      │ PDPTEntry 511   │      │ PDEntry 511     │      │ PTEntry 511     │
  └─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Defining page tables

Let's start by defining the structures for 4-level paging. Since we're going to need this both in the bootloader and in the kernel, we'll put it in a common module under `common/pagetables.nim`. One important point that we need to keep in mind is that the page tables need to be aligned on a 4 KiB boundary. We'll use Nim's `align` pragma to do this.

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
    physAddress* {.bitsize: 40.}: uint64 # bits 51:12
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
    physAddress* {.bitsize: 40.}: uint64 # bits 51:12
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
    physAddress* {.bitsize: 40.}: uint64 # bits 51:12
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
    physAddress* {.bitsize: 40.}: uint64 # bits 51:12
    ignored2* {.bitsize: 11.}: uint64    # bits 62:52
    xd* {.bitsize: 1.}: uint64           # bit     63

  # Page Map Level 4 Table
  PML4Table* = object
    entries* {.align(PageSize).}: array[512, PML4Entry]

  # Page Directory Pointer Table
  PDPTable* = object
    entries* {.align(PageSize).}: array[512, PDPTEntry]

  # Page Directory
  PDTable* = object
    entries* {.align(PageSize).}: array[512, PDEntry]

  # Page Table
  PTable* = object
    entries* {.align(PageSize).}: array[512, PTEntry]

  PageAccess* = enum
    paRead = 0
    paReadWrite = 1

  PageMode* = enum
    pmSupervisor = 0
    pmUser = 1

proc `[]`*(pml4: ptr PML4Table; index: uint64): var PML4Entry {.inline.} = pml4.entries[index]
proc `[]`*(pdpt: ptr PDPTable; index: uint64): var PDPTEntry {.inline.} = pdpt.entries[index]
proc `[]`*(pd: ptr PDTable; index: uint64): var PDEntry {.inline.} = pd.entries[index]
proc `[]`*(pt: ptr PTable; index: uint64): var PTEntry {.inline.} = pt.entries[index]
```

::: tip Note
Ideally we wouldn't need to define an `entries` array field within each object, and we could just define the tables like so:
  
  ```nim
  PML4Table* {.align(PageSize).} = array[512, PML4Entry]
  ```

Then we could access the table by indexing directly into its variable, e.g. `pml4[i]`, instead of `pml4.entries[i]`. Unfortunately Nim doesn't support type-level alignment (yet). See this [RFC](https://github.com/nim-lang/RFCs/issues/545). So, as a workaround, I defined index operators for each table type, which just forward the indexing to the `entries` field.
:::

## Accessing page tables

OK, we have the page table structures defined. But before we start using them, we need to think about how we're going to access them. Let's look at a simple example:

- We allocate a `PML4Table` instance (call it `pml4`).
- We allocate a `PDPTable` instance.
- We modify `pml4[0].physAddress` to point to the physical address of the `PDPTable` instance.
- At some later point, we want to modify that `PDPTable` instance. But how do we get its virtual address? All we have is its physical address through `pml4[0].physAddress`.

We need a way to reverse map a physical address to a virtual address. Here are some solutions:

- Identity-mapping the page tables
  - Pros: simple; no need to reverse map
  - Cons: pollutes the user address space (since physical memory is in the lower half)
- Mapping page tables at a constant offset from their physical addresses
  - Pros: simple; reverse mapping is trivial
  - Cons: requires creating new mappings for each page table
- Mapping the entire physical memory at a known virtual address
  - Pros: simple; reverse mapping is trivial
  - Cons: requires dedicating a range of virtual addresses for the entire physical memory
- Recursive page tables
  - Pros: doesn't require additional mappings
  - Cons: complex; accessing a page table requires that it be currently active, which means we need to switch to it first (sometimes this is not feasible)

We'll go with the third option (mapping the entire physical memory at a known virtual address). This makes reverse mapping trivial, and also gives us the ability to address any location in physical memory in a simple way. We'll use the virtual address `0xFFFFFFFF80000000` for this purpose.

## Mapping pages

Mapping pages will require allocating physical memory frames to hold the page tables themselves. In the kernel, we'll use the physical memory manager to allocate these frames. However, we'll also need to create page tables in the bootloader to map a few regions before we jump to the kernel. So instead of letting the VMM use the PMM implicitly, we'll pass our VMM a callback that it can use to allocate physical memory frames. This will allow us to use the VMM from both the kernel and the bootloader.

Let's define a couple of types and a `vmInit` proc that initializes the VMM.

```nim
# src/boot/vmm.nim

type
  VirtAddr* = distinct uint64
  PhysAlloc* = proc (nframes: uint64): Option[PhysAddr]

var
  physicalMemoryVirtualBase: uint64
  pmalloc: PhysAlloc

proc vmInit*(physMemoryVirtualBase: uint64, physAlloc: PhysAlloc) =
  physicalMemoryVirtualBase = physMemoryVirtualBase
  pmalloc = physAlloc
```

Let's also add a couple of templates for pointer arithmetic on virtual addresses, which will make our code more readable.

```nim
# src/boot/vmm.nim
...

template `+!`*(p: VirtAddr, offset: uint64): VirtAddr =
  VirtAddr(cast[uint64](p) + offset)

template `-!`*(p: VirtAddr, offset: uint64): VirtAddr =
  VirtAddr(cast[uint64](p) - offset)
```

We'll also need two procs that map virtual addresses to physical addresses and vice versa. We'll call them `p2v` and `v2p`. The `p2v` proc is simple: it just adds the virtual memory base to the physical address. The `v2p` proc is more complex. It needs to traverse the page tables to find the physical address that corresponds to the virtual address. In order to do this, it needs to know the current active page table, so we'll add a `getActivePML4` proc that returns a pointer to the active PML4 table. We'll also add a `setActivePML4` proc that sets the active PML4 table. (The `{.experimental: "codeReordering".}` pragma is optional, but it lets us use procs before they are defined, thus avoiding the need to forward-declare them.)

```nim
# src/boot/vmm.nim

import common/pagetables
import pmm  # only needed for PhysAddr

{.experimental: "codeReordering".}

proc p2v*(phys: PhysAddr): VirtAddr =
  result = cast[VirtAddr](phys +! physicalMemoryVirtualBase)

proc v2p*(virt: VirtAddr): Option[PhysAddr] =
  let pml4 = getActivePML4()

  var pml4Index = (virt.uint64 shr 39) and 0x1FF
  var pdptIndex = (virt.uint64 shr 30) and 0x1FF
  var pdIndex = (virt.uint64 shr 21) and 0x1FF
  var ptIndex = (virt.uint64 shr 12) and 0x1FF

  if pml4.entries[pml4Index].present == 0:
    result = none(PhysAddr)
    return

  let pdptPhysAddr = PhysAddr(pml4.entries[pml4Index].physAddress shl 12)
  let pdpt = cast[ptr PDPTable](p2v(pdptPhysAddr))

  if pdpt.entries[pdptIndex].present == 0:
    result = none(PhysAddr)
    return

  let pdPhysAddr = PhysAddr(pdpt.entries[pdptIndex].physAddress shl 12)
  let pd = cast[ptr PDTable](p2v(pdPhysAddr))

  if pd.entries[pdIndex].present == 0:
    result = none(PhysAddr)
    return

  let ptPhysAddr = PhysAddr(pd.entries[pdIndex].physAddress shl 12)
  let pt = cast[ptr PTable](p2v(ptPhysAddr))

  if pt.entries[ptIndex].present == 0:
    result = none(PhysAddr)
    return

  result = some PhysAddr(pt.entries[ptIndex].physAddress shl 12)

proc getActivePML4*(): ptr PML4Table =
  var cr3: uint64
  asm """
    mov %0, cr3
    : "=r"(`cr3`)
  """
  result = cast[ptr PML4Table](p2v(cr3.PhysAddr))

proc setActivePML4*(pml4: ptr PML4Table) =
  var cr3 = v2p(cast[VirtAddr](pml4)).get
  asm """
    mov cr3, %0
    :
    : "r"(`cr3`)
  """
```

We can now write a function to map a virtual page to a physical page. We'll extract 4 index values from the virtual address, and use them to insert (or update) the appropriate entries in the page tables. To avoid repeating a lot of the code, I created a `getOrCreateEntry` generic proc, which will return an entry if it exists in the parent table, or allocate a new page (for the child table) if it doesn't and sets the appropriate entry in the parent table.

```nim
# src/boot/vmm.nim
...

proc getOrCreateEntry[TP, TC](parent: ptr TP, index: uint64): ptr TC =
  var physAddr: PhysAddr
  if parent[index].present == 1:
    physAddr = PhysAddr(parent[index].physAddress shl 12)
  else:
    physAddr = pmalloc(1).get # TODO: handle allocation failure
    parent[index].physAddress = physAddr.uint64 shr 12
    parent[index].present = 1
  result = cast[ptr TC](p2v(physAddr))

proc mapPage(
  pml4: ptr PML4Table,
  virtAddr: VirtAddr,
  physAddr: PhysAddr,
  pageAccess: PageAccess,
  pageMode: PageMode,
) =
  let pml4Index = (virtAddr.uint64 shr 39) and 0x1FF
  let pdptIndex = (virtAddr.uint64 shr 30) and 0x1FF
  let pdIndex = (virtAddr.uint64 shr 21) and 0x1FF
  let ptIndex = (virtAddr.uint64 shr 12) and 0x1FF

  let access = cast[uint64](pageAccess)
  let mode = cast[uint64](pageMode)

  # Page Map Level 4 Table
  pml4[pml4Index].write = access
  pml4[pml4Index].user = mode
  var pdpt = getOrCreateEntry[PML4Table, PDPTable](pml4, pml4Index)

  # Page Directory Pointer Table
  pdpt[pdptIndex].write = access
  pdpt[pdptIndex].user = mode
  var pd = getOrCreateEntry[PDPTable, PDTable](pdpt, pdptIndex)

  # Page Directory
  pd[pdIndex].write = access
  pd[pdIndex].user = mode
  var pt = getOrCreateEntry[PDTable, PTable](pd, pdIndex)

  # Page Table
  pt[ptIndex].physAddress = physAddr.uint64 shr 12
  pt[ptIndex].present = 1
  pt[ptIndex].write = access
  pt[ptIndex].user = mode
```

> Notice the power of Nim generics here, which is structurally typed. The `getOrCreateEntry` proc accesses fields of the `TP` generic type (the parent table type), and the compiler will make sure that the fields exist in the object that is passed to the proc. We don't have to provide type constraints on the generic types, and we don't have to use inheritance or interfaces.

The caller needs to pass a pointer to `PML4Table` (the root of the page tables), which they are responsible for allocating. At every level of the table hierarchy, we check if the entry is present. If it is, we use the physical address stored in the entry to get the virtual address of the next table. If it isn't, we allocate a new physical memory frame and store its address in the entry (and set the `present` bit in the entry to `1`). We also update the `write` and `user` bits at every level, so that the page is accessible in the way that the caller requested.

In addition to mapping a single page, we'll occasionally need to map a range of pages. We'll also need to identity-map pages in some cases. Let's add procs for these as well.

```nim
# src/boot/vmm.nim

proc mapRegion*(
  pml4: ptr PML4Table,
  virtAddr: VirtAddr,
  physAddr: PhysAddr,
  pageCount: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode,
) =
  for i in 0 ..< pageCount:
    mapPage(pml4, virtAddr +! i * PageSize, physAddr +! i * PageSize, pageAccess, pageMode)

proc identityMapRegion*(
  pml4: ptr PML4Table,
  physAddr: PhysAddr,
  pageCount: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode,
) =
  mapRegion(pml4, physAddr.VirtAddr, physAddr, pageCount, pageAccess, pageMode)
```

OK, we should have everything we need to set up the page tables. In the next section we'll look into modifying the bootloader to load the kernel into the higher half of the address space.
