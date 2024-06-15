# ELF Loader (Part 2)

So far we have the code that loads the task image into memory in the `tasks` module. We also have
code that applies relocations in the `loader` module. Now that we're going to deal with ELF, it's
time to move all task loading code into the `loader` module (which will use the `elf` module to read
the ELF file).

## Loading ELF

We don't have a filesystem yet, so we still are going to rely on the user task being loaded by the
bootloader into memory, until we implement a filesystem. The task loader will use the in-memory ELF
binary to "load" the task by:

- allocating enough virtual memory for the task
- mapping virtual memory to physical memory with the correct permissions
- copying the loadable segments into their respective virtual memory regions
- applying relocation entries to the loaded segments
- identifying the entry point and returning it to the caller

Let's start by adding a new proc to the `loader` module to load an ELF binary, given the address of
the raw ELF image in memory. The first step is to iterate over the segments and build a
corresponding list of page-aligned VM regions.

```nim
# src/kernel/loader.nim

import elf
import vmm

proc load*(imagePtr: pointer) =
  let image = initElfImage(imagePtr)

  # get a list of page-aligned memory regions to be mapped
  var vmRegions: seq[VMRegion] = @[]
  for (i, ph) in segments(image):
    if ph.type == ElfProgramHeaderType.Load:
      if ph.align != PageSize:
        raise newException(LoaderError, &"Unsupported alignment {ph.align:#x} for segment {i}")
      let startOffset = ph.vaddr mod PageSize
      let startPage = ph.vaddr - startOffset
      let numPages = (startOffset + ph.memsz + PageSize - 1) div PageSize
      let region = VMRegion(
        start: startPage.VirtAddr,
        npages: numPages,
        flags: cast[VMRegionFlags](ph.flags),
      )
      vmRegions.add(region)
```

Notice that we need to keep track of the segment flags as well, as they will be used to set the page
permissions. We didn't have that `flags` field on `VMRegion` before, so let's add it now:

```nim{7-13}
# src/kernel/vmm.nim

type
  VMRegion* = object
    start*: VirtAddr
    npages*: uint64
    flags*: VMRegionFlags

  VMRegionFlag* = enum
    Execute = (0, "E")
    Write   = (1, "W")
    Read    = (2, "R")
  VMRegionFlags* {.size: sizeof(uint32).} = set[VMRegionFlag]
```

Now, let's validate a couple of assumptions: (1) there must be at least one segment, and (2) the
address of the start page of the first segment must be zero, since the ELF binary is supposed to be
relocatable (i.e. a PIE).

```nim
# src/kernel/loader.nim

type
  LoaderError* = object of CatchableError

proc load*(imagePtr: pointer) =
  ...

  if vmRegions.len == 0:
    raise newException(LoaderError, "No loadable segments found")

  if vmRegions[0].start.uint64 != 0:
    raise newException(LoaderError, "Expecting a PIE binary with a base address of 0")
```

Now, we have two options to allocate the required VM regions:

1. Allocate a single large region that spans all segments
2. Allocate one region per segment

The first option is simpler, but it may waste memory if the segments are not contiguous. The second
is more complex, because we have to maintain the relative positions of the segments to the base of
the first segment. Our virtual memory allocator is not prepared to handle this yet (it allocates
regoins in a best-fit manner), so we'll go with the first option for now.

```nim
# src/kernel/loader.nim

import std/algorithm
...

proc load*(imagePtr: pointer) =
  ...

  # calculate total memory size
  vmRegions = vmRegions.sortedByIt(it.start)
  let memSize = vmRegions[^1].end -! vmRegions[0].start
  let pageCount = (memSize + PageSize - 1) div PageSize

  # allocate a single contiguous region for the user image
  let taskRegion = vmalloc(uspace, pageCount)
```

Remember that the individual regions in the `vmRegions` list assume that the first region starts at 0. We need to adjust the start of each region to the base of the `taskRegion`:

```nim
# src/kernel/loader.nim

proc load*(imagePtr: pointer) =
  ...

  # adjust the individual regions' start addresses based on taskRegion.start
  for region in vmRegions.mitems:
    region.start = taskRegion.start +! region.start.uint64
```

Now we need to map the regions to physical memory. In addition to mapping them in the user address
space, we also need to temporarily map them in the kernel address space, so we can copy the segments
into the user space.

```nim
# src/kernel/loader.nim

proc load*(imagePtr: pointer) =
  ...

  # map each region into the page tables, making sure to set the R/W and NX flags as needed
  var kpml4 = getActivePML4()
  for region in vmRegions:
    let access = if region.flags.contains(Write): paReadWrite else: paRead
    let noExec = not region.flags.contains(Execute)
    let physAddr = vmmap(region, pml4, access, pmUser, noExec)
    # temporarily map the region in kernel space so that we can copy the segments and apply relocations
    mapRegion(
      pml4 = kpml4,
      virtAddr = region.start,
      physAddr = physAddr,
      pageCount = region.npages,
      pageAccess = paReadWrite,
      pageMode = pmSupervisor,
      noExec = true,
    )
```

OK, we're now ready to copy the segments into their respective regions. Remember that some segments
may have a memory size (`memsz`) that is larger than the corresponding size in the file (`filesz`),
as is the case with BSS segments. In such cases, we need to zero-fill the remaining memory.

```nim
# src/kernel/loader.nim

proc load*(imagePtr: pointer) =
  ...

  # copy loadable segments from the image to the user memory
  for (i, ph) in segments(image):
    if ph.type != ElfProgramHeaderType.Load:
      continue
    let dest = cast[pointer](taskRegion.start +! ph.vaddr)
    let src = cast[pointer](imagePtr +! ph.offset)
    copyMem(dest, src, ph.filesz)
    if ph.filesz < ph.memsz:
      zeroMem(cast[pointer](cast[uint64](dest) + ph.filesz), ph.memsz - ph.filesz)
```

The segments are now loaded into memory. The next step is to apply any relocations that may be
needed. Relocation metadata is stored in a segment of type `DYNAMIC`. We need to find this segment
in the ELF image and pass its offset to the `applyRelocations` proc.

```nim
# src/kernel/loader.nim

proc load*(imagePtr: pointer) =
  ...

  var dynOffset: int = -1

  for (i, ph) in segments(image):
    if ph.type == ElfProgramHeaderType.Dynamic:
      dynOffset = cast[int](ph.vaddr)

  if dynOffset == -1:
    raise newException(LoaderError, "No dynamic section found")

  applyRelocations(
    image = cast[ptr UncheckedArray[byte]](taskRegion.start),
    dynOffset = cast[uint64](dynOffset),
  )
```

We're alomst done. We're done with the kernel's temporary mapping of the user task's memory, so we
can unmap the regions now.

```nim
# src/kernel/loader.nim

proc load*(imagePtr: pointer) =
  ...

  # unmap the user image from kernel space
  for region in vmRegions:
    unmapRegion(kpml4, region.start, region.npages)
```

Finally, we need to return information about the loaded task to the caller, in particular the VM
region where the task was loaded and the entry point.

```nim
# src/kernel/loader.nim

type
  LoadedElfImage* = object
    vmRegion*: VMRegion
    entryPoint*: pointer

proc load*(imagePtr: pointer): LoadedElfImage =
  ...

  result = LoadedElfImage(
    vmRegion: taskRegion,
    entryPoint: cast[pointer](taskRegion.start +! image.header.entry)
  )
```
