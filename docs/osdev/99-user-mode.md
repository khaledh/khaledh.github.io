# User Mode

Running programs in user mode is one of the most important features of an operating system. It provides a controlled environment for programs to run in, and prevents them from interfering with each other or the kernel. This is done by restricting the instructions that can be executed, and the memory that can be accessed. Once in user mode, a program can only return to kernel mode by executing a system call or through an interrupt (e.g. a timer interrupt). Even exiting the program requires a system call. We won't be implementing system calls in this section. We'll just focus on switching from kernel mode to user mode. The user program won't be able to do anything useful for now, but we should have a minimal user mode environment to build on later.

The main way to switch to user mode is to create a stack frame that resembles an interrupt stack frame, as if the user program had just been interrupted by an interrupt. It should look like this:

```text
         User Stack
                     ┌──── stack bottom
    ┌────────────────▼─┐
    │        SS        │ +32  ◄── Data segment selector
    ├──────────────────┤
    │        RSP       │ +24  ◄── User stack pointer
    ├──────────────────┤
    │       RFLAGS     │ +16  ◄── CPU flags with IF=1
    ├──────────────────┤
    │        CS        │ +8   ◄── User code segment selector
    ├──────────────────┤
    │        RIP       │ 0    ◄── User code entry point
    ├────────────────▲─┤
    │                └──── stack top
    ├──────────────────┤
```

Then we can use the `iretq` instruction to switch to user mode. The `iretq` instruction pops the stack frame, loads the SS and RSP registers to switch to the user stack, and loads the CS and RIP registers to switch to the user code. The CPU will also set the IF flag to 1, which enables interrupts. This is important because we want to be able to switch back to kernel mode later.

An important thing to note is that, since this stack frame is at the bottom of the user stack, if the user program returns from the entry point, a page fault will occur, since the area above the stack is unmapped. As mentioned earlier, the only way to return to kernel mode is through a system call or an interrupt. So for the purpose of this section, we'll just create a user function that never returns.

## Preparing for User Mode

So far, the virtual memory mapping we have is for kernel space only. We need to create a different mapping for user space so that the user program can access it. This includes mapping of the user code, data, and stack regions. We won't be implementing program loading yet, so the user code will be compiled as part of the kernel, but it will be mapped in user space. For the user stack, we'll use a static array in the kernel (for now) and also map it to user space. Also, since we're going to switch page tables before executing the `iretq` instruction, we need to make sure that kernel space (at least the part doing the switching) is mapped in the user page table as well (otherwise we'll get a page fault). We don't have to worry about user mode accessing kernel space, since kernel pages are marked as supervisor-only.

So here's the plan to get user mode working:

1. Create a function that we want to run in user mode. The function will be part of the compiled kernel, but it will be executed in user mode.
2. Create a 4 KiB static array for the user stack.
3. Create a new page table for user space.
4. Map the user code, data, and stack regions to user space.
5. Copy the kernel paging entries to the user page table.
6. Craft an interrupt stack frame that will switch to user mode. Place it at the bottom of the user stack (i.e. the top of the mapped page).
7. Change the `rsp` register to point to the top of the interrupt stack frame (i.e. to where `RIP` is stored).
8. Load the user page table into the `cr3` register.
9. Use the `iretq` instruction to switch to user mode.

## User Code

Let's start by creating a new module in `src/user/task.nim` for the user code, and defining a function that we want to run in user mode. We'll call it `UserMain`.

```nim
# src/user/task.nim
{.used.}

proc UserMain() =
  while true:
    asm "pause"
```

The function will just execute the `pause` instruction in a loop. The `pause` instruction is a hint to the CPU that the code is in a spin loop, allowing it to greatly reduce the processor's power consumption.

To be able to map this function to user space, we need to get its physical address. For now, we can find the physical address by calculating the offset of the proc from the kernel base virtual address, then add that offset to the kernel base physical address. We also need to make sure the function is aligned to a 4 KiB page boundary, so that we can map it to a 4 KiB page. We can do this by adding an entry to the linker script for the function's section.

```ld
SECTIONS
{
  . = 0xFFFF800000100000;
  .text   : {
    *main*.o(.*text.KernelMain)
    *main*.o(.*text.*)

    . = ALIGN(4096);
    *user*task*.o(.*text.UserMain)
    . = ALIGN(4096);

    *(.*text*)
  }
  .rodata : { *(.*rodata*) }
  .data   : { *(.*data) *(.*bss) }
  .shstrtab : { *(.shstrtab) }

  /DISCARD/ : { *(*) }
}
```

By surrounding the function section with `ALIGN(4096)` directives, we can make sure that the function is aligned to a 4 KiB boundary, and occupy a whole page (at least until we start adding more code/data to the user task module). Let's compile and take a look at the kernel linker map.

```text
             VMA              LMA     Size Align Out     In      Symbol
               0                0 ffff800000000000     1 . = 0xFFFF800000100000
...
ffff800000001099 ffff800000001099      f67     1         . = ALIGN ( 4096 )
ffff800000002000 ffff800000002000       59    16         .../fusion/build/@m..@suser@stask.nim.c.o:(.ltext.UserMain)
ffff800000002000 ffff800000002000       59     1                 UserMain
ffff800000002059 ffff800000002059      fa7     1         . = ALIGN ( 4096 )
ffff800000003000 ffff800000003000        0     4         .../fusion/build/@m..@s..@s..@s..@s..@s..@s.choosenim@stoolchains@snim-2.0.0@slib@ssystem@sexceptions.nim.c.o:(.text)
```

This looks good. The `UserMain` function starts at `0xFFFF800000002000`, which is aligned to a 4 KiB boundary. The size of the function is `0x59` bytes, which is less than 4 KiB, but the next section is aligned to a 4 KiB boundary (`ffff800000003000`), so the function section indeed occupies a whole page.

## User Page Table

Before we can start mapping user pages, we need a way to convert virtual addresses to physical addresses. Let's create a proc to do that in `src/kernel/paging.nim`.

```nim
# src/kernel/paging.nim
...

const
  KernelPhysicalBase = 0x100000'u64
  KernelVirtualBase = 0xFFFF800000100000'u64

proc virt2phys(virt: pointer): uint64 =
  virtAddr = cast[uint64](virt)
  result = (virtAddr - KernelVirtualBase) + KernelPhysicalBase
```

So far we've been using the page table structures created by the bootloader for the kernel. Keep in mind that they were created in an identity-mapped environment, so the virtual and physical addresses were the same. If we allocate new page tables now, we'll need to use their physical addresses to populate their parent entries in the page table structures (e.g. a `PML4Entry` must contain the physical address of a `PDPTable` structure). So any time we allocate a paging structure, we'll need to convert its virtual address to a physical address. We'll use the `virt2phys` proc for that.

The current implementation of `mapPage` in `src/kernel/paging.nim` is based on identity-mapped pages. It's currently being used by the bootloader, so we'll have to make it work for both the bootloader and the kernel. We can do this by adding two optional parameters: a proc that converts a virtual address to a physical address, and another that does the opposite. If the parameters are `nil`, we'll assume that the virtual address is the same as the physical address. Otherwise, we'll use the procs to do the conversion.

```nim{4-5,13-14,16-22,38-39,42-43,50-51,54-55,62-63,66-67}
# src/kernel/paging.nim
...

proc virt2physIdentity(virt: uint64): uint64 = virt
proc phys2virtIdentity(phys: uint64): uint64 = phys

proc mapPage*(
  pml4: PML4Table,
  virtAddr: uint64,
  physAddr: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode,
  virt2phys: proc (virt: pointer): uint64 = nil,
  phys2virt: proc (phys: uint64): pointer = nil,
) =
  var v2p = virt2phys
  if v2p.isNil:
    v2p = virt2physIdentity
  
  var p2v = phys2virt
  if p2v.isNil:
    p2v = phys2virtIdentity

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
    let pdptVirtAddr = p2v(cast[uint64](pml4.entries[pml4Index].physAddress) shl 12)
    pdpt = cast[PDPTable](pdptVirtAddr)
  else:
    pdpt = new PDPTable
    let pdptPhysAddr = v2p(pdpt.entries.addr)
    pml4.entries[pml4Index].physAddress = pdptPhysAddr shr 12
    pml4.entries[pml4Index].write = access
    pml4.entries[pml4Index].user = mode
    pml4.entries[pml4Index].present = 1

  # Page Directory Pointer Table
  if pdpt.entries[pdptIndex].present == 1:
    let pdVirtAddr = p2v(cast[uint64](pdpt.entries[pdptIndex].physAddress) shl 12)
    pd = cast[PDTable](pdVirtAddr)
  else:
    pd = new PDTable
    let pdPhysAddr = v2p(pd.entries.addr)
    pdpt.entries[pdptIndex].physAddress = pdPhysAddr shr 12
    pdpt.entries[pdptIndex].write = access
    pdpt.entries[pdptIndex].user = mode
    pdpt.entries[pdptIndex].present = 1

  # Page Directory
  if pd.entries[pdIndex].present == 1:
    let ptVirtAddr = p2v(cast[uint64](pd.entries[pdIndex].physAddress) shl 12)
    pt = cast[PTable](ptVirtAddr)
  else:
    pt = new PTable
    let ptPhysAddr = v2p(pt.entries.addr)
    pd.entries[pdIndex].physAddress = ptPhysAddr shr 12
    pd.entries[pdIndex].write = access
    pd.entries[pdIndex].user = mode
    pd.entries[pdIndex].present = 1

  # Page Table
  pt.entries[ptIndex].physAddress = physAddr shr 12
  pt.entries[ptIndex].write = access
  pt.entries[ptIndex].user = mode
  pt.entries[ptIndex].present = 1
```

We'll also need to update the `mapRegion` proc to use the new `mapPage` proc.

```nim{10-11,14}
# src/kernel/paging.nim

proc mapRegion*(
  pml4: PML4Table,
  virtAddr: uint64,
  physAddr: uint64,
  numPages: uint64,
  pageAccess: PageAccess,
  pageMode: PageMode,
  virt2phys: proc (virt: pointer): uint64 = nil,
  phys2virt: proc (phys: uint64): pointer = nil,
) =
  for i in 0 ..< numPages:
    mapPage(pml4, virtAddr + i * 4096, physAddr + i * 4096, pageAccess, pageMode, virt2phys, phys2virt)
```

Now, let's create a new `PML4Table` for the user page table.

```nim
# src/kernel/main.nim

import paging

