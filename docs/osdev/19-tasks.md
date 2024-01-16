# Tasks

We're starting to accumulate a number of things about the user program that the kernel needs to track: the user page table, the user stack, the kernel switch stack, and the user `rsp` when executing `syscall`. These are all currently tracked in global variables. Once we start having more than one user task, it will be hard to keep track of all these things.

## Task definition

Let's define a `Task` type to encapsulate all this information. This will prepare us for having multiple tasks. Let's create a new module `tasks.nim` for this.

```nim
# src/kernel/tasks.nim

import common/pagetables
import vmm

type
  TaskStack* = object
    data*: ptr uint8
    size*: uint64

  Task* = ref object
    id*: uint64
    pml4*: ptr PML4Table
    ustack*: TaskStack
    kstack*: TaskStack
    rsp*: uint64

var
  nextId*: uint64 = 0

proc bottom*(s: TaskStack): uint64 =
  result = cast[uint64](s.data) + s.size
```

Each task has a unique `id`, a pointer to its page table, and two stacks: one for user mode and one for kernel mode. The `rsp` field is where the user stack pointer is stored when the task is executing in kernel mode (e.g. when executing a system call). We also define a `TaskStack` type to encapsulate the stack pointer and size. The `bottom` proc is a convenience function to get the bottom of the stack (i.e. the address just beyond the end of the stack). The `nextId` variable will be used to assign unique IDs to each task.

Before we can start creating tasks, we need a way to allocate virtual memory within an address space. Let's add a few things to the virtual memory manager to support this.

## Address space abstraction

For a particular address space, we need to track which regions are currently allocated, and a way to allocate more regions. We'll use this to allocate the user stack and kernel stack. To make it easy to refer to a particular address space, and track which regions are currently allocated in it, we'll define a `VMAddressSpace` type.

```nim
# src/kernel/vmm.nim

type
  VMRegion* = object
    start: VirtAddr
    npages: uint64

  VMAddressSpace* = object
    minAddress*: VirtAddr
    maxAddress*: VirtAddr
    regions*: seq[VMRegion]
    pml4*: ptr PML4Table
```

Notice that I also defined a `VMRegion` type to represent a contiguous region of virtual memory. Notice also that I defined two fields `minAddress` and `maxAddress` in `VMAddressSpace` to track the minimum and maximum addresses in the address space. This will make it easy to confine the address space to the lower half (for user space) or upper half (for kernel space) of the virtual address space.

Let's now add a proc to allocate virtual memory in an address space.

```nim
# src/kernel/vmm.nim

proc vmalloc*(
  space: var VMAddressSpace,
  pageCount: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode,
): Option[VirtAddr] =
  # find a free region
  var virtAddr: VirtAddr = space.minAddress
  for region in space.regions:
    if virtAddr +! pageCount * PageSize <= region.start:
      break
    virtAddr = region.start +! region.npages * PageSize

  # allocate physical memory and map it
  let  physAddr = pmalloc(pageCount).get # TODO: handle allocation failure
  mapRegion(space.pml4, virtAddr, physAddr, pageCount, pageAccess, pageMode)

  # add the region to the address space
  space.regions.add VMRegion(start: virtAddr, npages: pageCount)

  result = some virtAddr
```

The `vmalloc` proc finds a free region in the address space, allocates physical memory, and maps it into the address space. It returns the virtual address of the allocated region.

We also need a way to add existing VM regions to an address space. We'll need this to add the existing kernel VM regions (code/data and stack) to its address space.

```nim
# src/kernel/vmm.nim

proc vmAddRegion*(space: var VMAddressSpace, start: VirtAddr, npages: uint64) =
  space.regions.add VMRegion(start: start, npages: npages)
```

## Kernel address space

The kernel itself needs its own address space. Let's create a global variable `kspace` to track it.

```nim
# src/kernel/vmm.nim
...

const
  KernelSpaceMinAddress* = 0xffff800000000000'u64.VirtAddr
  KernelSpaceMaxAddress* = 0xffffffffffffffff'u64.VirtAddr
  UserSpaceMinAddress* = 0x0000000000000000'u64.VirtAddr
  UserSpaceMaxAddress* = 0x00007fffffffffff'u64.VirtAddr

var
  kspace*: VMAddressSpace

proc vmInit*(physMemoryVirtualBase: uint64, physAlloc: PhysAlloc) =
  physicalMemoryVirtualBase = physMemoryVirtualBase
  pmalloc = physAlloc
  kspace = VMAddressSpace(
    minAddress: KernelSpaceMinAddress,
    maxAddress: KernelSpaceMaxAddress,
    regions: @[],
    pml4: getActivePML4(),
  )
```

Let's also add the existing kernel VM regions to it (code/data and stack).

```nim
# src/kernel/main.nim
...

proc KernelMain(bootInfo: ptr BootInfo) {.exportc.} =
  ...

  debug "kernel: Initializing virtual memory manager "
  vmInit(bootInfo.physicalMemoryVirtualBase, pmm.pmAlloc)
  vmAddRegion(kspace, bootInfo.kernelImageVirtualBase.VirtAddr, bootInfo.kernelImagePages)
  vmAddRegion(kspace, bootInfo.kernelStackVirtualBase.VirtAddr, bootInfo.kernelStackPages)
  debugln "[success]"
```

## Creating a task

Creating a task involves the following steps:

1. Creating a VM address space and allocating a page table
2. Mapping the task image (code and data) into the task page table
3. Mapping the kernel space into the task page table
4. Allocating and mapping a user stack (in user space)
5. Allocating and mapping a kernel stack (in kernel space)
6. Creating an interrupt stack frame on the kernel stack (for switching to user mode)
7. Setting the `rsp` field to the interrupt stack frame

This seems like a lot of steps, but it's not too bad. Let's add a `createTask` proc to the `tasks` module to do all this.

```nim
# src/kernel/tasks.nim

proc createTask*(
  imageVirtAddr: VirtAddr,
  imagePhysAddr: PhysAddr,
  imagePageCount: uint64,
  entryPoint: VirtAddr
): Task =
  new(result)

  let taskId = nextId
  inc nextId

  var uspace = VMAddressSpace(
    minAddress: UserSpaceMinAddress,
    maxAddress: UserSpaceMaxAddress,
    pml4: cast[ptr PML4Table](new PML4Table)
  )

  # map user image
  mapRegion(
    pml4 = uspace.pml4,
    virtAddr = imageVirtAddr,
    physAddr = imagePhysAddr,
    pageCount = imagePageCount,
    pageAccess = paReadWrite,
    pageMode = pmUser,
  )

  # map kernel space
  var kpml4 = getActivePML4()
  for i in 256 ..< 512:
    uspace.pml4.entries[i] = kpml4.entries[i]

  # create user stack
  let ustackRegion = vmalloc(uspace, 1, paReadWrite, pmUser)
  if ustackRegion.isNone:
    raise newException(Exception, "tasks: Failed to allocate user stack")
  let ustack = TaskStack(
    data: cast[ptr UncheckedArray[uint64]](ustackRegion.get),
    size: 1 * PageSize
  )

  # create kernel stack
  let kstackRegion = vmalloc(kspace, 1, paReadWrite, pmSupervisor)
  if kstackRegion.isNone:
    raise newException(Exception, "tasks: Failed to allocate kernel stack")
  let kstack = TaskStack(
    data: cast[ptr UncheckedArray[uint64]](kstackRegion.get),
    size: 1 * PageSize
  )

  # get kernel-mapped virtual address of user stack
  let ustackPhysAddr = v2p(cast[VirtAddr](ustack.data), uspace.pml4)
  if ustackPhysAddr.isNone:
    raise newException(Exception, "tasks: Failed to get physical address of user stack")
  let ustackPtr = cast[ptr UncheckedArray[uint64]](p2v(ustackPhysAddr.get))

  # create interrupt stack frame on the kernel stack
  var index = kstack.size div 8
  kstack.data[index - 1] = cast[uint64](DataSegmentSelector) # SS
  kstack.data[index - 2] = cast[uint64](ustack.bottom) # RSP
  kstack.data[index - 3] = cast[uint64](0x202) # RFLAGS
  kstack.data[index - 4] = cast[uint64](UserCodeSegmentSelector) # CS
  kstack.data[index - 5] = cast[uint64](entryPoint) # RIP

  result.id = taskId
  result.space = uspace
  result.ustack = ustack
  result.kstack = kstack
  result.rsp = cast[uint64](kstack.data[index - 5].addr)
```

Most of this code is not new, we just put it together in one place. The only new thing is calling `vmalloc` to allocate the user stack and kernel stack (which in turn allocates the backing physical memory). We no longer need to create global arrays to statically allocate the stacks. Notice also that the kernel stack is allocated in the kernel space, not the user space, and is marked as supervisor-only.

## Switching to a task

The part responsible for switching to a task was at the end of the `KernelMainInner` proc. Let's move it to the `tasks` module.

```nim
# src/kernel/tasks.nim

proc switchTo*(task: var Task) {.noreturn.} =
  tss.rsp0 = task.kstack.bottom
  let rsp = task.rsp
  setActivePML4(task.space.pml4)
  asm """
    mov rbp, 0
    mov rsp, %0
    iretq
    :
    : "r"(`rsp`)
  """
```

We update `tss.rsp0` to point to the kernel stack (so it can be used when the task switches to kernel mode), set the active page table to the task's page table, set the `rsp` register to the tasks's `rsp` field (which should point to the interrupt stack frame), and then execute `iretq` to switch to the task.

## Trying it out

We can now replace a big chunk of the code we had in `KernelMainInner` with a call to `createTask` and `switchTo`.

```nim
# src/kernel/main.nim
...

proc KernelMain(bootInfo: ptr BootInfo) {.exportc.} =
  ...

  debugln "kernel: Creating user task"
  var task = createTask(
    imageVirtAddr = UserImageVirtualBase.VirtAddr,
    imagePhysAddr = bootInfo.userImagePhysicalBase.PhysAddr,
    imagePageCount = bootInfo.userImagePages,
    entryPoint = UserImageVirtualBase.VirtAddr
  )

  debug "kernel: Initializing Syscalls "
  syscallInit(task.kstack.bottom)
  debugln "[success]"

  debugln "kernel: Switching to user mode"
  switchTo(task)
```

Let's try it out.

```text
kernel: Initializing GDT [success]
kernel: Initializing IDT [success]
kernel: Creating user task
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=2
syscall: print
user: Hello from user mode!
syscall: num=1
syscall: exit: code=0
```

Great! It's nice to be able to encapsulate all the task information in a `Task` object, and to be able to create a task and switch to it with just a few lines of code.
