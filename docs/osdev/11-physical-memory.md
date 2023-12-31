# Physical Memory

Managing physical memory involves being able to allocate and free physical page frames. We'll create a **Physical Memory Manager** (PMM) that will keep track of which physical pages are free and which are in use. There are many ways to implement a PMM, the most popular being a bitmap, a free list, and a free stack. I'll keep it simple and implement a free list.

## Free List

The free list will be a linked list of free memory regions. We will store the address of the list head in a global variable. Each node will be stored at the beginning of a free region, and will contain the region size in terms of frames, and a `next` pointer to the next node in the list. This way we don't have to allocate memory for the list itself (except for the list head pointer), since we will use the free regions themselves to store the list nodes. Here's what it might look like after a few allocations and frees:

```text
     0                                         Physical Memory                                       max
     ┌──┬────────────┬────────────┬──┬──────┬──────────────────────────────┬──┬─────────┬──────────────┐
size │4 │            │░░░░░░░░░░░░│2 │      │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│3 │         │░░░░░░░░░░░░░░│
     │  │    Free    │░░░░░░░░░░░░│  │ Free │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │   Free  │░░░░░░░░░░░░░░│
next ├──┤            │░░░░░░░░░░░░├──┤      │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░├──┤         │░░░░░░░░░░░░░░│
     └▲┬┴────────────┴────────────┴▲┬┴──────┴──────────────────────────────┴▲┬┴─────────┴──────────────┘
      │└───────────────────────────┘└───────────────────────────────────────┘│
head ─┘                                                                      └─▶ nil
```

Allocating a page frame will involve finding a free region that is large enough, splitting it if necessary, and returning the starting address of the allocated region. Freeing a region will involve finding the correct place in the list to insert the region, and merging it with adjacent regions if necessary.

Let's start by creating a new module `src/kernel/pmm.nim` and defining the following types:

- `PhysAddr` to represent a physical address
- `PMNode` to represent a node in the free list
- `PMRegion` to represent a region of memory

and the following variables:

- `head` to store the address of the list head
- `maxPhysAddr` to store the maximum physical address (exclusive)
- `reservedRegions` to store a list of reserved regions

```nim
# src/kernel/pmm.nim

const
  FrameSize = 4096

type
  PhysAddr = distinct uint64

  PMNode = object
    nframes: uint64
    next: ptr PMNode

  PMRegion* = object
    start*: PhysAddr
    nframes*: uint64

var
  head: ptr PMNode
  maxPhysAddr: PhysAddr # exclusive
  reservedRegions: seq[PMRegion]
```

We'll also define serveral utility procs:

- `toPMNodePtr` to convert from `ptr PMNode` to `PhysAddr`
- `toPhysAddr` to convert from `PhysAddr` to `ptr PMNode`
- `==`, `<`, and `-` operators for `PhysAddr`
- `endAddr` to calculate the end address of a region given its start address and size
- `adjacent` to check if a node is adjacent to a physical address (and vice versa)
- `overlaps` to check if two regions overlap

```nim
# src/kernel/pmm.nim

proc toPMNodePtr*(paddr: PhysAddr): ptr PMNode {.inline.} = cast[ptr PMNode](paddr)
proc toPhysAddr*(node: ptr PMNode): PhysAddr {.inline.} = cast[PhysAddr](node)

proc `==`*(a, b: PhysAddr): bool {.inline.} = a.uint64 == b.uint64
proc `<`(p1, p2: PhysAddr): bool {.inline.} = p1.uint64 < p2.uint64
proc `-`(p1, p2: PhysAddr): uint64 {.inline.} = p1.uint64 - p2.uint64

proc endAddr(paddr: PhysAddr, nframes: uint64): PhysAddr =
  result = paddr +! nframes * FrameSize

proc adjacent(node: ptr PMNode, paddr: PhysAddr): bool {.inline.} =
  result = (
    not node.isNil and
    node.toPhysAddr +! node.nframes * FrameSize == paddr
  )

proc adjacent(paddr: PhysAddr, nframes: uint64, node: ptr PMNode): bool {.inline.} =
  result = (
    not node.isNil and
    paddr +! nframes * FrameSize == node.toPhysAddr
  )

proc overlaps(region1, region2: PMRegion): bool =
  var r1 = region1
  var r2 = region2
  if r1.start > r2.start:
    r1 = region2
    r2 = region1
  result = (
    r1.start.PhysAddr < endAddr(r2.start.PhysAddr, r2.nframes) and
    r2.start.PhysAddr < endAddr(r1.start.PhysAddr, r1.nframes)
  )
```

Also, since we're going to do a lot of pointer arithmetic, let's define a `+!` operator for both `PhysAddr` and `ptr PMNode` that will allow us to add an offset to a physical address or a node pointer.

```nim
# src/kernel/pmm.nim

proc `+!`*(paddr: PhysAddr, offset: uint64): PhysAddr {.inline.} =
  PhysAddr(cast[uint64](paddr) + offset)

proc `+!`*(node: ptr PMNode, offset: uint64): ptr PMNode {.inline.} =
  cast[ptr PMNode](cast[uint64](node) + offset)
```

## Initialization

The kernel already has the memory map passed to it by the bootloader, so we'll use that to initialize the PMM.

```nim
import common/bootinfo
...

proc pmInit*(memoryMap: MemoryMap) =
  var prev: ptr PMNode

  for i in 0 ..< memoryMap.len:
    let entry = memoryMap.entries[i]
    if entry.type == MemoryType.Free:
      maxPhysAddr = endAddr(entry.start.PhysAddr, entry.nframes)
      if not prev.isNil and adjacent(prev, entry.start.PhysAddr):
        # merge contiguous regions
        prev.nframes += entry.nframes
      else:
        # create a new node
        var node: ptr PMNode = entry.start.PhysAddr.toPMNodePtr
        node.nframes = entry.nframes
        node.next = nil

        if not prev.isNil:
          prev.next = node
        else:
          head = node

        prev = node

    elif entry.type == MemoryType.Reserved:
      reservedRegions.add(PMRegion(start: entry.start.PhysAddr, nframes: entry.nframes))
    
    elif i > 0:
      # check if there's a gap between the previous entry and the current entry
      let prevEntry = memoryMap.entries[i - 1]
      let gap = entry.start.PhysAddr - endAddr(prevEntry.start.PhysAddr, prevEntry.nframes)
      if gap > 0:
        reservedRegions.add(PMRegion(
          start: endAddr(prevEntry.start.PhysAddr, prevEntry.nframes),
          nframes: gap div FrameSize
        ))
```

The initialization procedure iterates over the memory map entries, and for each free region it either merges it with the previous region if they are contiguous, or creates a new node and adds it to the list. We also track a couple of things that will be useful for validating requests to free regions:

- Reserved regions, either from the memory map or from gaps between memory map entries.
- The maximum physical address, which is the end address of the last free region.

To try it out and see if it works, we'll need a way to iterate over the list to print the nodes. Let's add an iterator for that.

```nim
# src/kernel/pmm.nim

iterator pmFreeRegions*(): tuple[paddr: PhysAddr, nframes: uint64] =
  var node = head
  while not node.isNil:
    yield (node.toPhysAddr, node.nframes)
    node = node.next
```

Let's now initialize the PMM and print the free regions.

```nim
# src/kernel/main.nim

import pmm
...

proc printFreeRegions() =
  debugln "kernel: Physical memory free regions "
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

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  debug "kernel: Initializing physical memory manager "
  pmInit(bootInfo.physicalMemoryMap)
  debugln "[success]"

  printFreeRegions()

  quit()
```

If we run the kernel now, we should see something like this:

```text
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x21a000           2152          6040        1510
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124328 KiB (121 MiB)
```

The list is much shorter than the original memory map, since we merged contiguous regions. Our PMM is now initialized and ready to be used.

## Allocating Frames

A memory manager is not very useful if we can't allocate and free memory. Let's start with adding a `pmAlloc` to allocate a contiguous region of physical memory.

```nim
# src/kernel/pmm.nim

import std/options
...

proc pmAlloc*(nframes: uint64): Option[PhysAddr] =
  ## Allocate a contiguous region of physical memory.
  assert nframes > 0, "Number of frames must be positive"

  var
    prev: ptr PMNode
    curr = head

  # find a region with enough frames
  while not curr.isNil and curr.nframes < nframes:
    prev = curr
    curr = curr.next
  
  if curr.isNil:
    # no region found
    return none(PhysAddr)
  
  var newnode: ptr PMNode
  if curr.nframes == nframes:
    # exact match
    newnode = curr.next
  else:
    # split the region
    newnode = toPMNodePtr(curr.toPhysAddr +! nframes * FrameSize)
    newnode.nframes = curr.nframes - nframes
    newnode.next = curr.next

  if not prev.isNil:
    prev.next = newnode
  else:
    head = newnode

  result = some(curr.toPhysAddr)
```

The procedure iterates over the list until it finds a region with enough frames, and then either splits the region if it's larger than necessary, or removes it from the list if it's an exact match. If there's no region large enough, it returns `none`. Let's try it out by allocating a few pages and printing the free regions.

```nim
# src/kernel/main.nim

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  debugln "kernel: Allocating 4 pages"
  let paddr = pmAlloc(4)
  if paddr.isSome:
    debugln &"kernel: Allocated at {paddr.get.uint64:#010x}"
    printFreeRegions()
  else:
    debugln "kernel: Allocation failed"
```

Let's run the kernel and see what happens.

```text
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124324 KiB (121 MiB)
kernel: Allocating 4 pages
kernel: Allocated at 0x00000000
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
             0x4000             16           624         156
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124308 KiB (121 MiB)
```

It looks like it worked. We can see that the first 4 pages are now allocated, and the free regions list is updated accordingly. Let's see what happens if we try to allocate more pages than available in the first free region.

```nim
  let paddr = pmAlloc(200)
```

```text
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124324 KiB (121 MiB)
kernel: Allocating 200 pages
kernel: Allocated at 0x0021b000
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x2e3000           2956          5236        1309
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 123524 KiB (120 MiB)
```

The first region is skipped because it's not large enough, and the second region is used to allocate the pages, and its start address is updated and its size is reduced. Let's see what happens if we allocate exactly the number of pages in the first region (160 pages).

```nim
  let paddr = pmAlloc(160)
```

```text
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124324 KiB (121 MiB)
kernel: Allocating 160 pages
kernel: Allocated at 0x00000000
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 123684 KiB (120 MiB)
```

The first region is now completely used, so it's removed from the list. Finally, let's see what happens if we try to allocate more pages than available in any free region.

```nim
  let paddr = pmAlloc(25000)
```

```text
kernel: Fusion Kernel
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions 
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x21b000           2156          6036        1509
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124324 KiB (121 MiB)
kernel: Allocating 25000 pages
kernel: Allocation failed
```

The allocation fails because there are no regions large enough to satisfy the request. 

## Freeing Frames

Freeing a region is a lot more challenging than allocating one, because we need to:

- validate the request to make sure the region is:
  - aligned to a page frame
  - within the physical memory range
  - not overlapping with any reserved regions
  - not overlapping with other free regions
- find the correct place in the free list to insert the region
- if it's adjacent to other free regions, merge it with them
- handle edge cases when the region is before or after all other regions

Who said that writing an OS is easy? Let's go ahead and implement `pmFree`.

```nim
# src/kernel/pmm.nim

proc pmFree*(paddr: PhysAddr, nframes: uint64) =
  ## Free a contiguous region of physical memory.
  assert paddr.uint64 mod FrameSize == 0, &"Unaligned physical address: {paddr.uint64:#x}"
  assert nframes > 0, "Number of frames must be positive"

  if paddr +! nframes * FrameSize > maxPhysAddr:
    # the region is outside of the physical memory
    raise newException(
      Exception,
      &"Attempt to free a region outside of the physical memory.\n" &
      &"  Request: start={paddr.uint64:#x} + nframes={nframes} > max={maxPhysAddr.uint64:#x}"
    )
  
  for region in reservedRegions:
    if overlaps(region, PMRegion(start: paddr, nframes: nframes)):
      # the region is reserved
      raise newException(
        Exception,
        &"Attempt to free a reserved region.\n" &
        &"  Request: start={paddr.uint64:#x}, nframes={nframes}\n" &
        &"  Reserved: start={region.start.uint64:#x}, nframes={region.nframes}"
      )

  var
    prev: ptr PMNode
    curr = head

  while not curr.isNil and curr.toPhysAddr < paddr:
    prev = curr
    curr = curr.next

  let
    overlapsWithCurr = not curr.isNil and paddr +! nframes * FrameSize > curr.toPhysAddr
    overlapsWithPrev = not prev.isNil and paddr < prev.toPhysAddr +! prev.nframes * FrameSize

  if overlapsWithCurr or overlapsWithPrev:
    raise newException(
      Exception,
      &"Attempt to free a region that overlaps with another free region.\n" &
      &"  Request: start={paddr.uint64:#x}, nframes={nframes}"
    )

  # the region to be freed is between prev and curr (either of them can be nil)

  if prev.isNil and curr.isNil:
    debugln "pmFree: the list is empty"
    # the list is empty
    var newnode = paddr.toPMNodePtr
    newnode.nframes = nframes
    newnode.next = nil
    head = newnode

  elif prev.isNil and adjacent(paddr, nframes, curr):
    debugln "pmFree: at the beginning, adjacent to curr"
    # at the beginning, adjacent to curr
    var newnode = paddr.toPMNodePtr
    newnode.nframes = nframes + curr.nframes
    newnode.next = curr.next
    head = newnode

  elif curr.isNil and adjacent(prev, paddr):
    debugln "pmFree: at the end, adjacent to prev"
    # at the end, adjacent to prev
    prev.nframes += nframes

  elif adjacent(prev, paddr) and adjacent(paddr, nframes, curr):
    debugln "pmFree: exactly between prev and curr"
    # exactly between prev and curr
    prev.nframes += nframes + curr.nframes
    prev.next = curr.next

  else:
    # not adjacent to any other region
    debugln "pmFree: not adjacent to any other region"
    var newnode = paddr.toPMNodePtr
    newnode.nframes = nframes
    newnode.next = curr
    if not prev.isNil:
      prev.next = newnode
    else:
      head = newnode
```

Let's try it out by allocating and freeing some regions.

```nim
# src/kernel/main.nim

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  printFreeRegions()

  debugln "kernel: Allocating 8 frames"
  let paddr = pmAlloc(8)
  if paddr.isNone:
    debugln "kernel: Allocation failed"
  printFreeRegions()

  debugln &"kernel: Freeing 2 frames at 0x2000"
  pmFree(0x2000.PhysAddr, 2)
  printFreeRegions()

  debugln &"kernel: Freeing 4 frames at 0x4000"
  pmFree(0x4000.PhysAddr, 4)
  printFreeRegions()

  debugln &"kernel: Freeing 2 frames at 0xa0000"
  pmFree(0xa0000.PhysAddr, 2)
  printFreeRegions()
```

If we run the kernel now, we should see something like this:

```text
kernel: Initializing physical memory manager [success]
kernel: Physical memory free regions
              Start     Start (KB)     Size (KB)      #Pages
                0x0              0           640         160
           0x223000           2188          6004        1501
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124292 KiB (121 MiB)
kernel: Allocating 8 frames
kernel: Physical memory free regions
              Start     Start (KB)     Size (KB)      #Pages
             0x8000             32           608         152
           0x223000           2188          6004        1501
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124260 KiB (121 MiB)
kernel: Freeing 2 frames at 0x2000
pmFree: not adjacent to any other region
kernel: Physical memory free regions
              Start     Start (KB)     Size (KB)      #Pages
             0x2000              8             8           2
             0x8000             32           608         152
           0x223000           2188          6004        1501
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124268 KiB (121 MiB)
kernel: Freeing 4 frames at 0x4000
pmFree: exactly between prev and curr
kernel: Physical memory free regions
              Start     Start (KB)     Size (KB)      #Pages
             0x2000              8           632         158
           0x223000           2188          6004        1501
           0x808000           8224            12           3
           0x80c000           8240            16           4
           0x900000           9216         92596       23149
          0x6372000         101832         17900        4475
          0x77ff000         122876          7124        1781
kernel: Total free: 124284 KiB (121 MiB)
kernel: Freeing 2 frames at 0xa0000

Unhandled exception: Attempt to free a reserved region.
  Request: start=0xa0000, nframes=2
  Reserved: start=0xa0000, nframes=96 [Exception]

Stack trace:
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(46) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(85) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/pmm.nim(164) pmFree
```

First we allocate 8 frames (starting at 0x0000), then we free 2 frames at 0x2000, and finally we free 4 frames at 0x4000. The request to free the region at 0x2000 is not adjacent to any other free region, so it's inserted in the list. The second region being freed at 0x4000 is now exactly between the first free region (ending at 0x4000) and the second free region (starting at 0x8000), so it's merged with them.

In the last free request, we try to free 2 frames at 0xa0000, which is a reserved region, so an exception is raised, which is exactly what we want. I'm not going to show all possible scenarios here, but I tested them and they all work as expected.

Phew! That was a lot of work, but we now have a working PMM. In the next chapter, we'll start looking at virtual memory.
