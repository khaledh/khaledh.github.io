# Loading the Kernel (Part 1)

In the last section we built a raw binary kernel image. We'll pick up where we left off in the bootloader and load the kernel image into memory. We'll rely on UEFI Boot Services to do so.

## UEFI Boot Services

UEFI Boot Services provides a number of services to help us, including accessing the file system, getting information about a file, allocating memory, and reading a file into memory. Here's the plan:

- Use the bootloader image `EfiHandle` (which is passed to the entry point) to get its `EfiLoadedImageProtocol`.
- Use the `EfiLoadedImageProtocol` device handle to get the `EfiSimpleFileSystemProtocol` of that device.
- Use the `EfiSimpleFileSystemProtocol` to get the `EfiFileSystemInfo` represnting the root directory of the file system.
- Use the `EfiSimpleFileSystemProtocol` and the kernel image path on the file system to get the `EfiFileProtocol` of the kernel file.
- Use the `EfiFileProtocol` to get the `EfiFileInfo` of the kernel file, which contains the size of the file.
- Use the Boot Services `AllocatePages` function to allocate enough pages, starting at address `0x100000` (1 MiB), to hold the kernel image.
- Use `AllocatePages` to allocate a region for the kernel stack.
- Use the `EfiFileProtocol` function to read the kernel image into memory.

After reading the kernel into memory, and before jumping to it, we'll need to call the Boot Services `ExitBootServices` function to signal to the UEFI firmware that we're done with the Boot Services. To do so, we're required to also call the `GetMemoryMap` function to get the memory map, which contains a key that we'll pass to `ExitBootServices`. We'll also eventually pass this memory map to the kernel. So in addition to the plan above, we'll also:

- Use the Boot Services `GetMemoryMap` function to get the memory map.
- Use the Boot Services `ExitBootServices` function, passing it the memory map key.
- Jump to the kernel image starting address.

This is a lot to take in, but it's how the UEFI spec was designed ¯\\_(ツ)_/¯. We'll take it one step at a time.

## Boot device handle

Since we plan on storing the kernel image on the same device as the bootloader, we want to access the file system of the device from which the bootloader was loaded. The `EfiLoadedImageProtocol` (which we can get through the bootloader image handle) has a `DeviceHandle` field that we can use to get the `EfiSimpleFileSystemProtocol` of that device. So let's define the `EfiLoadedImageProtocol` in `src/common/uefi.nim`.

```nim{10}
# src/common/uefi.nim

type
  ...
  EfiLoadedImageProtocol* = object
    revision*: uint32
    parentHandle*: EfiHandle
    systemTable*: ptr EfiSystemTable
    # Source location of the image
    deviceHandle*: EfiHandle
    filePath*: pointer
    reserved*: pointer
    # Image's load options
    loadOptionsSize*: uint32
    loadOptions*: pointer
    # Location where image was loaded
    imageBase*: pointer
    imageSize*: uint64
    imageCodeType*: EfiMemoryType
    imageDataType*: EfiMemoryType
    unload*: pointer
```

The `EfiMemoryType` defines the various types of memory in the system. At some point we'll need to allocate memory for the kernel (code, data, and stack), so we'll need to differentiate these types of memory. The UEFI spec doesn't define kernel memory types, so we'll add a few more custom types to the enum, which fall in the range of OSV (Operating System Vendor) defined memory types (`0x80000000` to `0xFFFFFFFF`).

```nim
  EfiMemoryType* = enum
    EfiReservedMemory
    EfiLoaderCode
    EfiLoaderData
    EfiBootServicesCode
    EfiBootServicesData
    EfiRuntimeServicesCode
    EfiRuntimeServicesData
    EfiConventionalMemory
    EfiUnusableMemory
    EfiACPIReclaimMemory
    EfiACPIMemoryNVS
    EfiMemoryMappedIO
    EfiMemoryMappedIOPortSpace
    EfiPalCode
    EfiPersistentMemory
    EfiUnacceptedMemory
    OsvKernelCode = 0x80000000
    OsvKernelData = 0x80000001
    OsvKernelStack = 0x80000002
    EfiMaxMemoryType
```

To get the `EfiLoadedImageProtocol` from the bootloader image handle, we'll use the `handleProtocol` function of the Boot Services. So let's define the `BootServices` type and the `handleProtocol` function in `src/common/uefi.nim`. It's a large type with many functions, so I won't define the type of every field; we'll use `pointer` for those fields until we need to use them.

```nim
# src/common/uefi.nim

type
  EfiBootServices* = object
    hdr*: EfiTableHeader
    # task priority services
    raiseTpl*: pointer
    restoreTpl*: pointer
    # memory services
    allocatePages*: pointer
    freePages*: pointer
    getMemoryMap*: pointer
    allocatePool*: pointer
    freePool*: pointer
    # event & timer services
    createEvent*: pointer
    setTimer*: pointer
    waitForEvent*: pointer
    signalEvent*: pointer
    closeEvent*: pointer
    checkEvent*: pointer
    # protocol handler services
    installProtocolInterface*: pointer
    reinstallProtocolInterface*: pointer
    uninstallProtocolInterface*: pointer
    handleProtocol*: proc (handle: EfiHandle, protocol: EfiGuid, `interface`: ptr pointer): EfiStatus {.cdecl.}
    reserved*: pointer
    registerProtocolNotify*: pointer
    locateHandle*: pointer
    locateDevicePath*: pointer
    installConfigurationTable*: pointer
    # image services
    loadImage*: pointer
    startImage*: pointer
    exit*: pointer
    unloadImage*: pointer
    exitBootServices*: pointer
    # misc services
    getNextMonotonicCount*: pointer
    stall*: pointer
    setWatchdogTimer*: pointer
    # driver support services
    connectController*: pointer
    disconnectController*: pointer
    # open and close protocol services
    openProtocol*: pointer
    closeProtocol*: pointer
    openProtocolInformation*: pointer
    # library services
    protocolsPerHandle*: pointer
    locateHandleBuffer*: pointer
    locateProtocol*: pointer
    installMultipleProtocolInterfaces*: pointer
    uninstallMultipleProtocolInterfaces*: pointer
    # 32-bit CRC services
    calculateCrc32*: pointer
    # misc services
    copyMem*: pointer
    setMem*: pointer
    createEventEx*: pointer
```

One of the parameters of the `handleProtocol` function is of type `EfiGuid`. Let's define it as well.

```nim
type
  EfiGuid* = object
    data1: uint32
    data2: uint16
    data3: uint16
    data4: array[8, uint8]
```

We're interested in the `EfiLoadedImageProtocol`, so we need to define its GUID.

```nim
const
  EfiLoadedImageProtocolGuid* = EfiGuid(
    data1: 0x5B1B31A1, data2: 0x9562, data3: 0x11d2,
    data4: [0x8e, 0x3f, 0x00, 0xa0, 0xc9, 0x69, 0x72, 0x3b]
  )
```

Now we're ready to call the `handleProtocol` function to get the `EfiLoadedImageProtocol` from the bootloader image handle.

```nim{3,6-11,,13-23}
# src/boot/bootx64.nim

import common/uefi
...

proc checkStatus*(status: EfiStatus) =
  if status != EfiSuccess:
    consoleOut &" [failed, status = {status:#x}]"
    quit()
  consoleOut " [success]\r\n"

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  echo "Fusion OS Bootloader"

  var status: EfiStatus

  # get the LoadedImage protocol from the image handle
  var loadedImage: ptr EfiLoadedImageProtocol

  consoleOut "boot: Acquiring LoadedImage protocol"
  checkStatus uefi.sysTable.bootServices.handleProtocol(
    imgHandle, EfiLoadedImageProtocolGuid, cast[ptr pointer](addr loadedImage)
  )
...
```

Let's compile and run everything using `just run`. We should see the following output (The colored output is for nice visuals only. I didn't show it in the code above; I'm leaving it as an exercise for the reader):

![Boot - LoadedImage](boot-loadedimage.png)

## File system

Now that we have the `EfiLoadedImageProtocol` device handle, we can get the `EfiSimpleFileSystemProtocol` of that device. Let's define the `EfiSimpleFileSystemProtocol` type and the corresponding GUID in `src/common/uefi.nim`.

```nim
# src/common/uefi.nim

type
  EfiSimpleFileSystemProtocol* = object
    revision*: uint64
    openVolume*: pointer

const
  EfiSimpleFileSystemProtocolGuid* = EfiGuid(
    data1: 0x964e5b22'u32, data2: 0x6459, data3: 0x11d2,
    data4: [0x8e, 0x39, 0x00, 0xa0, 0xc9, 0x69, 0x72, 0x3b]
  )
```

Now we're ready to get the `EfiSimpleFileSystemProtocol` from the `EfiLoadedImageProtocol` device handle.

```nim{4-10}
proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # get the FileSystem protocol from the device handle
  var fileSystem: ptr EfiSimpleFileSystemProtocol

  consoleOut "boot: Acquiring SimpleFileSystem protocol"
  checkStatus uefi.sysTable.bootServices.handleProtocol(
    loadedImage.deviceHandle, EfiSimpleFileSystemProtocolGuid, cast[ptr pointer](addr fileSystem)
  )
```

If we compile and run we should see the following output:

![Alt text](boot-simplefilesystem.png)

## Root directory

Next, we need to get the `EfiFileInfo` representing the root directory of the file system. Let's define the `EfiFileInfo` type (we also need to define the `EfiTime` type, which is used in `EfiFileInfo`) .

```nim
# src/common/uefi.nim

type
  EfiFileInfo* = object
    size*: uint64
    fileSize*: uint64
    physicalSize*: uint64
    createTime*: EfiTime
    lastAccessTime*: EfiTime
    modificationTime*: EfiTime
    attribute*: uint64
    fileName*: array[256, Utf16Char]

  EfiTime* = object
    year*: uint16
    month*: uint8
    day*: uint8
    hour*: uint8
    minute*: uint8
    second*: uint8
    pad1*: uint8
    nanosecond*: uint32
    timeZone*: int16
    daylight*: uint8
    pad2*: uint8
```

The `fileName` field in the UEFI spec is a C [flexible array member](https://en.wikipedia.org/wiki/Flexible_array_member), which is not supported in Nim. So I'm using a fixed size array here.

Let's use the `openVolume` function of the `EfiSimpleFileSystemProtocol` to get the `EfiFileInfo` of the root directory. First, we need to update the signature of `openVolume`, which also requires defining the `EfiFileProtocol` type.

```nim{6-24}
# src/common/uefi.nim

type
  EfiSimpleFileSystemProtocol* = object
    revision*: uint64
    openVolume*: proc (this: ptr EfiSimpleFileSystemProtocol, root: ptr ptr EfiFileProtocol):
      EfiStatus {.cdecl.}

  EfiFileProtocol* = object
    revision*: uint64
    open*: pointer
    close*: pointer
    delete*: pointer
    read*: pointer
    write*: pointer
    getPosition*: pointer
    setPosition*: pointer
    getInfo*: pointer
    setInfo*: pointer
    flush*: pointer
    openEx*: pointer
    readEx*: pointer
    writeEx*: pointer
    flushEx*: pointer
```

Now we're ready to get the `EfiFileInfo` of the root directory.

```nim{6-10}
# src/boot/bootx64.nim

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # open the root directory
  var rootDir: ptr EfiFileProtocol

  consoleOut "boot: Opening root directory"
  checkStatus fileSystem.openVolume(fileSystem, addr rootDir)
```

This should also compile and run successfully.

## Kernel image file

We have the `EfiFileProtocol` of the root directory, so we can use it to get the `EfiFileProtocol` of the kernel image file, given its path. To open the kernel file, we'll need to define the `open` function of the `EfiFileProtocol`.

```nim{6-12}
# src/common/uefi.nim

type
  EfiFileProtocol* = object
    revision*: uint64
    open*: proc (
        this: ptr EfiFileProtocol,
        newHandle: ptr ptr EfiFileProtocol,
        fileName: WideCString,
        openMode: uint64,
        attributes: uint64
      ): EfiStatus {.cdecl.}
  ...
```

Now we're ready to open the kernel file.

```nim{6-12}
# src/boot/bootx64.nim

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # open the kernel file
  var kernelFile: ptr EfiFileProtocol
  let kernelPath = W"efi\fusion\kernel.bin"

  consoleOut "boot: Opening kernel file: "
  consoleOut kernelPath
  checkStatus rootDir.open(rootDir, addr kernelFile, kernelPath, 1, 1)
```

This should also compile and run successfully.

![Boot - Open kernel file](boot-openkernelfile.png)

Let's now get the size of the kernel file. To do so, we'll need to define the `getInfo` function of the `EfiFileProtocol`. We'll also need to define `EfiFileInfoGuid`.

```nim{6-11,15-18}
# src/common/uefi.nim

type
  EfiFileProtocol* = object
    ...
    getInfo*: proc (
        this: ptr EfiFileProtocol,
        infoType: ptr EfiGuid,
        infoSize: ptr uint,
        info: pointer
      ): EfiStatus {.cdecl.}
  ...

const
  EfiFileInfoGuid* = EfiGuid(
    data1: 0x09576e92'u32, data2: 0x6d3f, data3: 0x11d2,
    data4: [0x8e, 0x39, 0x00, 0xa0, 0xc9, 0x69, 0x72, 0x3b]
  )
```

Let's call the `getInfo` function on the kernel file.

```nim{6-12}
# src/boot/bootx64.nim

proc EfiMainInner(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus =
  ...

  # get kernel file size
  var kernelInfo: EfiFileInfo
  var kernelInfoSize = sizeof(EfiFileInfo).uint

  consoleOut "boot: Getting kernel file info"
  checkStatus kernelFile.getInfo(kernelFile, addr EfiFileInfoGuid, addr kernelInfoSize, addr kernelInfo)
  echo &"boot: Kernel file size: {kernelInfo.fileSize} bytes"
```

If all goes well, we should see the kernel file size in the output:

![Boot - Kernel file size](boot-kernelfilesize.png)

Great! The kernel image size is what we expect (around 1.1 MiB). In the next section we'll continue to allocate memory for the kernel image and read it into memory.
