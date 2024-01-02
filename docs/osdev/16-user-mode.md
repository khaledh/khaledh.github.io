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

So far, the virtual memory mapping we have is for kernel space only. We need to create a different mapping for user space so that the user program can access it. This includes mapping of the user code, data, and stack regions, as well as the kernel space (which is protected since it's marked as supervisor only).

Since we don't have the ability in the kernel to access disks and filesystems yet, we won't be load the user program from disk. What we can do is build the user program separately, and copy it alongside the kernel image, and let the bootloader load it for us.

So here's the plan to get user mode working:

1. Create a program that we want to run in user mode.
2. Build the program and copy it to the `efi\fusion` directory (next to the kernel image).
3. In the bootloader, load the user program into memory, and pass its physical address and size to the kernel.
4. Create a 4 KiB static array for the user stack.
5. Create a new page table for user space.
6. Map the user code and stack regions to user space.
7. Copy the kernel paging entries to the user page table.
8. Craft an interrupt stack frame that will switch to user mode. Place it at the bottom of the user stack (i.e. the top of the mapped page).
9. Change the `rsp` register to point to the top of the interrupt stack frame (i.e. to where `RIP` is stored).
10. Load the user page table into the `cr3` register.
11. Use the `iretq` instruction to switch to user mode.

## User Program

Let's start by creating a new module in `src/user/utask.nim` for the user code, and defining a function that we want to run in user mode. We'll call it `UserMain`.

```nim
# src/user/utask.nim
{.used.}

proc UserMain() =
  while true:
    asm "pause"
```

The function will just execute the `pause` instruction in a loop. The `pause` instruction is a hint to the CPU that the code is in a spin loop, allowing it to greatly reduce the processor's power consumption.

Let's create a linker script to define the layout of the user code and data sections. It's very similar to the kernel linnker script, except we link the user program at a virtual address in user space, instead of kernel space.

```ld
# src/user/utask.ld

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
  # open the kernel file
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

  # close the kernel file
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

Now, let's create a new `PML4Table` for the user page table.