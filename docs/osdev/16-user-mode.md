# User Mode

Running programs in user mode is one of the most important features of an operating system. It provides a controlled environment for programs to run in, and prevents them from interfering with each other or the kernel. This is done by restricting the instructions that can be executed, and the memory that can be accessed. Once in user mode, a program can only return to kernel mode by executing a system call or through an interrupt (e.g. a timer interrupt). Even exiting the program requires a system call. We won't be implementing system calls in this section. We'll just focus on switching from kernel mode to user mode. The user program won't be able to do anything useful for now, but we should have a minimal user mode environment to build on later.

The main way to switch to user mode is to manually create an interrupt stack frame, as if the user program had just been interrupted by an interrupt. It should look like this:

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

Then we can use the `iretq` instruction to switch to user mode. The `iretq` instruction pops the stack frame, loads the `SS` and `RSP` registers to switch to the user stack, loads the `RFLAGS` register, and loads the `CS` and `RIP` registers to switch to the user code entry point. The `RFLAGS` value should have the IF flag set to 1, which enables interrupts. This is important because we want to be able to switch back to kernel mode later.

An important thing to note is that, since this stack frame is at the bottom of the user stack (i.e. highest address in the page where the stack is mapped), if the user program returns from the entry point, a page fault will occur, since the area above the stack is unmapped. As mentioned earlier, the only way to return to kernel mode is through a system call or an interrupt. So for the purpose of this section, we'll just create a user function that never returns.

## Preparing for User Mode

So far, the virtual memory mapping we have is for kernel space only. We need to create a different mapping for user space so that the user program can access it. This includes mapping of the user code, data, and stack regions, as well as the kernel space (which is protected since it's marked as supervisor only). Mapping the kernel space in the user page table is necessary, since interrupts and system calls cause the CPU to jump to kernel code without switching page tables.

Since we don't have the ability in the kernel to access disks and filesystems yet, we won't be load the user program from disk. What we can do is build the user program separately, and copy it alongside the kernel image, and let the bootloader load it for us. So here's the plan to get user mode working:

1. Create a program that we want to run in user mode.
2. Build the program and copy it to the `efi\fusion` directory (next to the kernel image).
3. In the bootloader, load the user program into memory, and pass its physical address and size to the kernel.
4. Allocate memory for the user stack.
5. Create a new page table for user space.
6. Map the user code and stack regions to user space.
7. Copy the kernel space page table entries to the user page table.
8. Craft an interrupt stack frame that will switch to user mode. Place it at the bottom of the user stack (i.e. the top of the mapped stack region).
9. Change the `rsp` register to point to the top of the interrupt stack frame (i.e. the last pushed value).
10. Load the user page table physical address into the `cr3` register.
11. Use the `iretq` instruction to pop the interrupt stack frame and switch to user mode.

## User Program

Let's start by creating a new module in `src/user/utask.nim` for the user code, and defining a function that we want to run in user mode. We'll call it `UserMain`.

```nim
# src/user/utask.nim

{.used.}

proc NimMain() {.importc.}

proc UserMain() =
  NimMain()

  asm """
  .loop:
    pause
    jmp .loop
  """
```

The function will just execute the `pause` instruction in a loop. The `pause` instruction is a hint to the CPU that the code is in a spin loop, allowing it to greatly reduce the processor's power consumption.

Let's create a linker script to define the layout of the user code and data sections. It's very similar to the kernel linker script, except we link the user program at a virtual address in user space, instead of kernel space (it doesn't matter where in user space, as long as it's mapped).

```ld
/* src/user/utask.ld */

SECTIONS
{
  . = 0x00000000040000000; /* 1 GiB */
  .text   : {
    *utask*.o(.*text.UserMain)
    *utask*.o(.*text.*)
    *(.*text*)
  }
  .rodata : { *(.*rodata*) }
  .data   : { *(.*data) *(.*bss) }

  .shstrtab : { *(.shstrtab) } /* cannot be discarded */
  /DISCARD/ : { *(*) }
}
```

Now, let's add a `nim.cfg` file to the `src/user` directory to configure the Nim compiler for the user program. It should be very similar to the kernel `nim.cfg` file.

```properties
# src/user/nim.cfg

amd64.any.clang.linkerexe = "ld.lld"

--passc:"-target x86_64-unknown-none"
--passc:"-ffreestanding"
--passc:"-ffunction-sections"
--passc:"-mcmodel=large"

--passl:"-nostdlib"
--passl:"-T src/user/utask.ld"
--passl:"-entry=UserlMain"
--passl:"-Map=build/utask.map"
--passl:"--oformat=binary"
```

Let's update our `justfile` to build the user program and copy it in place.

```justfile{3-4,8-9,11,16,31}
...

user_nim := "src/user/utask.nim"
user_out := "utask.bin"

...

user:
  nim c {{nimflags}} --out:build/{{user_out}} {{user_nim}}

run *QEMU_ARGS: bootloader kernel user
  mkdir -p {{disk_image_dir}}/efi/boot
  mkdir -p {{disk_image_dir}}/efi/fusion
  cp build/{{boot_out}} {{disk_image_dir}}/efi/boot/{{boot_out}}
  cp build/{{kernel_out}} {{disk_image_dir}}/efi/fusion/{{kernel_out}}
  cp build/{{user_out}} {{disk_image_dir}}/efi/fusion/{{user_out}}

  @echo ""
  qemu-system-x86_64 \
    -drive if=pflash,format=raw,file={{ovmf_code}},readonly=on \
    -drive if=pflash,format=raw,file={{ovmf_vars}} \
    -drive format=raw,file=fat:rw:{{disk_image_dir}} \
    -machine q35 \
    -net none \
    -debugcon stdio {{QEMU_ARGS}}

clean:
  rm -rf build
  rm -rf {{disk_image_dir}}/efi/boot/{{boot_out}}
  rm -rf {{disk_image_dir}}/efi/fusion/{{kernel_out}}
  rm -rf {{disk_image_dir}}/efi/fusion/{{user_out}}
```

Finally, let's build the user program and check the linker map.

```sh-session
$ just user

$ head -n 20 build/utask.map
        VMA              LMA     Size Align Out     In      Symbol
          0                0 40000000     1 . = 0x00000000040000000
   40000000         40000000     9fec    16 .text
   40000000         40000000       59    16         .../fusion/build/@mutask.nim.c.o:(.ltext.UserMain)
   40000000         40000000       59     1                 UserMain
   40000060         40000060       9b    16         .../fusion/build/@mutask.nim.c.o:(.ltext.nimFrame)
   40000060         40000060       9b     1                 nimFrame
   40000100         40000100       12    16         .../fusion/build/@mutask.nim.c.o:(.ltext.PreMainInner)
   40000100         40000100       12     1                 PreMainInner
   40000120         40000120       1e    16         .../fusion/build/@mutask.nim.c.o:(.ltext.PreMain)
```

This looks good. The `UserMain` function linked first and starts at `0x40000000`, which is what we asked for.

## Loading the User Program

Now, let's try to load the user program in the bootloader. We'll do the same thing we did for the kernel, except we'll load the user program to an arbitrary physical address, instead of a specific address. We'll mark this region of memory as `UserCode` so that it's not considered free.

In the bootloader, we already have code that loads the kernel image. Let's reuse this code to load the user program. Let's refactor this code into a `loadImage` proc, and use it for both the kernel and the user task.

```nim
# src/boot/bootx64.nim

proc loadImage(
  imagePath: WideCString,
  rootDir: ptr EfiFileProtocol,
  memoryType: EfiMemoryType,
  loadAddress: Option[EfiPhysicalAddress] = none(EfiPhysicalAddress),
): tuple[base: EfiPhysicalAddress, pages: uint64] =
  # open the image file
  var file: ptr EfiFileProtocol

  consoleOut "boot: Opening image: "
  consoleOut imagePath
  checkStatus rootDir.open(rootDir, addr file, imagePath, 1, 1)

  # get file size
  var fileInfo: EfiFileInfo
  var fileInfoSize = sizeof(EfiFileInfo).uint

  consoleOut "boot: Getting file info"
  checkStatus file.getInfo(
    file, addr EfiFileInfoGuid, addr fileInfoSize, addr fileInfo
  )
  echo &"boot: Image file size: {fileInfo.fileSize} bytes"

  var imageBase: EfiPhysicalAddress
  let imagePages = (fileInfo.fileSize + 0xFFF).uint div PageSize.uint # round up to nearest page

  consoleOut &"boot: Allocating memory for image"
  if loadAddress.isSome:
    imageBase = cast[EfiPhysicalAddress](loadAddress.get)
    checkStatus uefi.sysTable.bootServices.allocatePages(
      AllocateAddress,
      memoryType,
      imagePages,
      cast[ptr EfiPhysicalAddress](imageBase.addr)
    )
  else:
    checkStatus uefi.sysTable.bootServices.allocatePages(
      AllocateAnyPages,
      memoryType,
      imagePages,
      cast[ptr EfiPhysicalAddress](imageBase.addr)
    )

  # read the image into memory
  consoleOut "boot: Reading image into memory"
  checkStatus file.read(file, cast[ptr uint](addr fileInfo.fileSize), cast[pointer](imageBase))

  # close the image file
  consoleOut "boot: Closing image file"
  checkStatus file.close(file)

  result = (imageBase, imagePages.uint64)
```

The proc allows loading an image at a specific address (if `loadAddress` is provided), or at any address (if `loadAddress` is `none`). The former is useful for loading the kernel image, since we want to load it at a specific address. The latter is useful for loading the user program, since we don't care where it's loaded.

Let's now update the `EfiMainInner` by replacing that section of the code with two calls to `loadImage`.

```nim{13-26}
# src/boot/bootx64.nim
...

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # open the root directory
  var rootDir: ptr EfiFileProtocol

  consoleOut "boot: Opening root directory"
  checkStatus fileSystem.openVolume(fileSystem, addr rootDir)

  # load kernel image
  let (kernelImageBase, kernelImagePages) = loadImage(
    imagePath = W"efi\fusion\kernel.bin",
    rootDir = rootDir,
    memoryType = OsvKernelCode,
    loadAddress = KernelPhysicalBase.EfiPhysicalAddress.some
  )

  # load user task image
  let (userImageBase, userImagePages) = loadImage(
    imagePath = W"efi\fusion\utask.bin",
    rootDir = rootDir,
    memoryType = OsvUserCode,
  )

  # close the root directory
  consoleOut "boot: Closing root directory"
  checkStatus rootDir.close(rootDir)
```

Notice that I added a new value to the `EfiMemoryType` enum called `OsvUserCode`. This is just a value that we'll use to mark the user code region as used. Here's the updated enum:

```nim{9}
# src/common/uefi.nim
...

  EfiMemoryType* = enum
    ...
    OsvKernelCode = 0x80000000
    OsvKernelData = 0x80000001
    OsvKernelStack = 0x80000002
    OsvUserCode = 0x80000003
    EfiMaxMemoryType
```

Let's map this value to a new `UserCode` value in our `MemoryType` enum (which is what we pass to the kernel as part of the memory map). While we're here, I'm going to also add values for `UserData` and `UserStack` (which we'll use later).

```nim{10-12}
# src/common/bootinfo.nim
...

type
  MemoryType* = enum
    Free
    KernelCode
    KernelData
    KernelStack
    UserCode
    UserData
    UserStack
    Reserved
```

Let's also update `convertUefiMemoryMap` to account for the new memory type.

```nim{17-18}
# src/boot/bootx64.nim

proc convertUefiMemoryMap(...): seq[MemoryMapEntry] =
   ...

  for i in 0 ..< uefiNumMemoryMapEntries:
    ...
    let memoryType =
      if uefiEntry.type in FreeMemoryTypes:
        Free
      elif uefiEntry.type == OsvKernelCode:
        KernelCode
      elif uefiEntry.type == OsvKernelData:
        KernelData
      elif uefiEntry.type == OsvKernelStack:
        KernelStack
      elif uefiEntry.type == OsvUserCode:
        UserCode
      else:
        Reserved
    ...
```

And finally, we need to tell the kernel where to find the user task image in memory. Let's add a couple of fields to `BootInfo` to store the user image physical address and number of pages.

```nim{8-9}
# src/common/bootinfo.nim
...

  BootInfo* = object
    physicalMemoryMap*: MemoryMap
    virtualMemoryMap*: MemoryMap
    physicalMemoryVirtualBase*: uint64
    userTaskPhysicalBase*: uint64
    userTaskPages*: uint64
```

And to populate the fields, we'll update `createBootInfo` to take the values returned by `loadImage` as parameters.

```nim{9-10,14-15,30-31}
# src/boot/bootx64.nim

proc createBootInfo(
  bootInfoBase: uint64,
  kernelImagePages: uint64,
  physMemoryPages: uint64,
  physMemoryMap: seq[MemoryMapEntry],
  virtMemoryMap: seq[MemoryMapEntry],
  userImageBase: uint64,
  userImagePages: uint64,
): ptr BootInfo =
  ...

  bootInfo.userImagePhysicalBase = userImageBase
  bootInfo.userImagePages = userImagePages

  result = bootInfo

...

proc EfiMain(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  ...

  let bootInfo = createBootInfo(
    bootInfoBase,
    kernelImagePages,
    physMemoryPages,
    physMemoryMap,
    virtMemoryMap,
    userImageBase,
    userImagePages,
  )
  ...
```

Let's test it out by printing the user image physical address and number of pages in the kernel.

```nim
# src/kernel/main.nim
...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  debugln &"kernel: User image physical address: {bootInfo.userImagePhysicalBase:#010x}"
  debugln &"kernel: User image pages: {bootInfo.userImagePages}"
```

If we build and run the kernel, we should see the following output:

```text
kernel: Fusion Kernel
...
kernel: Initializing GDT [success]
kernel: Initializing IDT [success]
kernel: User image physical address: 0x06129000
kernel: User image pages: 268
```

It seems like it's working. The user image is loaded at some address allocated by the bootloader. The kernel now knows where to find the user image, and should be able to map it to user space.

## User Page Table

Now, let's create a new `PML4Table` for the user page table. We'll copy the kernel page table entries to the user page table, and map the user code and stack regions to user space.

```nim
# src/kernel/main.nim
...

const
  UserImageVirtualBase = 0x0000000040000000
  UserStackVirtualBase = 0x0000000050000000

...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  debugln ""
  debugln "kernel: Fusion Kernel"

  ...

  debugln "kernel: Initializing user page table"
  var upml4 = cast[ptr PML4Table](new PML4Table)

  debugln "kernel:   Copying kernel space user page table"
  var kpml4 = getActivePML4()
  for i in 256 ..< 512:
    upml4.entries[i] = kpml4.entries[i]

  debugln &"kernel:   Mapping user image ({UserImageVirtualBase} -> {bootInfo.userImagePhysicalBase:#x})"
  mapRegion(
    pml4 = upml4,
    virtAddr = UserImageVirtualBase.VirtAddr,
    physAddr = bootInfo.userImagePhysicalBase.PhysAddr,
    pageCount = bootInfo.userImagePages,
    pageAccess = paReadWrite,
    pageMode = pmUser,
  )

  # allocate and map user stack
  let userStackPhysAddr = pmAlloc(1).get
  debugln &"kernel:   Mapping user stack ({UserStackVirtualBase:#x} -> {userStackPhysAddr.uint64:#x})"
  mapRegion(
    pml4 = upml4,
    virtAddr = UserStackVirtualBase.VirtAddr,
    physAddr = userStackPhysAddr,
    pageCount = 1,
    pageAccess = paReadWrite,
    pageMode = pmUser,
  )
```

This should be straightforward. A few things to note:

- We don't physically copy the kernel page table structures to the user page table. We just set the PML4 entries to point to the same page table structures as the kernel page table. This makes the kernel space portion of the user page table dynamic, so that if we change the kernel page table, the user page table will automatically reflect the changes (unless we map new PML4 entries in the kernel page table, which we won't do for now).
- We're setting the `pageMode` to `pmUser` for the user code and stack regions.
- We allocate one page for the user stack, and map it to the virtual address `0x50000000`, so the stack region will be `0x50000000` to `0x50001000` (end address is exclusive).

## Interrupt Stack Frame

Now, in order to switch to user mode, we'll create an interrupt stack frame, as if the user program had just been interrupted. We'll populate five entries at the bottom of the stack: `RIP`, `CS`, `RFLAGS`, `RSP`, and `SS`.

```nim
# src/kernel/main.nim
...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  debugln "kernel: Creating interrupt stack frame"
  let userStackBottom = UserStackVirtualBase + PageSize
  let userStackPtr = cast[ptr array[512, uint64]](p2v(userStackPhysAddr))
  userStackPtr[^1] = cast[uint64](DataSegmentSelector) # SS
  userStackPtr[^2] = cast[uint64](userStackBottom) # RSP
  userStackPtr[^3] = cast[uint64](0x202) # RFLAGS
  userStackPtr[^4] = cast[uint64](UserCodeSegmentSelector) # CS
  userStackPtr[^5] = cast[uint64](UserImageVirtualBase) # RIP
  debugln &"            SS: {userStackPtr[^1]:#x}"
  debugln &"           RSP: {userStackPtr[^2]:#x}"
  debugln &"        RFLAGS: {userStackPtr[^3]:#x}"
  debugln &"            CS: {userStackPtr[^4]:#x}"
  debugln &"           RIP: {userStackPtr[^5]:#x}"

  let rsp = cast[uint64](userStackBottom - 5 * 8)
```

Stack terminology can be confusing. The stack grows downwards, so the bottom of the stack is the highest address. This is why we set `userStackBottom` to the _end_ of the stack region. Now, in order to manipulate the stack region from the kernel, we reverse map the stack's physical address to a virtual address, and cast it to a pointer to an array of 512 `uint64` values (remember that `UserStackVirtualBase` is valid only in the user page table, not the kernel page table). We then populate the five entries at the bottom of the stack, and set `rsp` to point to the last entry. This simulates pushing the interrupt stack frame on the stack.

## Switching to User Mode

We're finally ready to switch to user mode. We'll activate the user page table, set the `rsp` register to point to the interrupt stack frame, and use the `iretq` instruction to switch to user mode.

```nim
# src/kernel/main.nim

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  debugln "kernel: Switching to user mode"
  setActivePML4(upml4)
  asm """
    mov rbp, 0
    mov rsp, %0
    iretq
    :
    : "r"(`rsp`)
  """
```

If we did everything correctly, we should see the following output:

```text
kernel: Fusion Kernel
...
kernel: Initializing user page table
kernel:   Copying kernel space user page table
kernel:   Mapping user image (1073741824 -> 0x6129000)
kernel:   Mapping user stack (0x50000000 -> 0x3000)
kernel: Creating interrupt stack frame
            SS: 0x1b
           RSP: 0x50001000
        RFLAGS: 0x202
            CS: 0x13
           RIP: 0x40000000
kernel: Switching to user mode
```

How do we know we're in user mode? Well, we can't really tell from the output, so let's use QEMU's monitor to check the CPU registers.

```sh-session{8,10}
(qemu) info registers

CPU#0
RAX=0000000000000000 RBX=0000000000000000 RCX=0000000050000fc8 RDX=0000000000000000
RSI=0000000000000001 RDI=0000000050000fc8 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c30 R9 =0000000000000001 R10=000000000636d001 R11=0000000000000004
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=000000004000004c RFL=00000206 [-----P-] CPL=3 II=0 A20=1 SMM=0 HLT=0
ES =001b 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =0013 0000000000000000 000fffff 002ffa00 DPL=3 CS64 [-R-]
SS =001b 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
DS =001b 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
FS =001b 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
GS =001b 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT
TR =0000 0000000000000000 0000ffff 00008b00 DPL=0 TSS64-busy
GDT=     ffff800000226290 0000001f
IDT=     ffff8000002262b0 00000fff
...
```

We can see that `CPL=3`, which means we're in user mode! The `CS` register is `0x13`, which is the user code segment selector (`0x10` with `RPL=3`). The `RIP` register is `0x4000004c`, which is several instructions into the `UserMain` function. Let's try to disassemble the code at the entry point.

```sh-session{18-19}
(qemu) x /15i 0x40000000
0x40000000:  55                       pushq    %rbp
0x40000001:  48 89 e5                 movq     %rsp, %rbp
0x40000004:  48 83 ec 30              subq     $0x30, %rsp
0x40000008:  48 b8 8b a6 00 40 00 00  movabsq  $0x4000a68b, %rax
0x40000010:  00 00
0x40000012:  48 89 45 d8              movq     %rax, -0x28(%rbp)
0x40000016:  48 b8 7d a5 00 40 00 00  movabsq  $0x4000a57d, %rax
0x4000001e:  00 00
0x40000020:  48 89 45 e8              movq     %rax, -0x18(%rbp)
0x40000024:  48 c7 45 e0 00 00 00 00  movq     $0, -0x20(%rbp)
0x4000002c:  66 c7 45 f0 00 00        movw     $0, -0x10(%rbp)
0x40000032:  48 b8 70 00 00 40 00 00  movabsq  $0x40000070, %rax
0x4000003a:  00 00
0x4000003c:  48 8d 7d d0              leaq     -0x30(%rbp), %rdi
0x40000040:  ff d0                    callq    *%rax
0x40000042:  48 c7 45 e0 06 00 00 00  movq     $6, -0x20(%rbp)
0x4000004a:  f3 90                    pause
0x4000004c:  e9 f9 ff ff ff           jmp      0x4000004a
```

Looks like we're executing the `UserMain` function! Notice that the last two instructions are a `pause` instruction and a jump to the `pause` instruction. This is the loop we created in the `UserMain` function. We can also see that the `RIP` register is set to `0x4000004c`, which is the address of the `jmp` instruction. Everything seems to be working as expected.

This is another big milestone! We now have a minimal user mode environment. It's not very useful yet, but we'll build on it in the next section. We should look into system calls next, but before we do that, we need to allow the CPU to switch back to kernel mode. This requires something called the Task State Segment (TSS), which we'll cover in the next section.
