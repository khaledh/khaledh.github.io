# UEFI Bootloader - Part 2

In the previous section, we wrote a simple UEFI entry point for the bootloader. In this section, we'll use the UEFI API provided to us through the UEFI system table to print a simple message to the screen.

## UEFI System Table

The UEFI system table is a data structure that is passed to the bootloader by the UEFI firmware. It contains pointers to various UEFI services, such as the console, file system, and memory management. We'll start by defining the system table in `src/bootx64.nim`:

```nim
# src/bootx64.nim

type
  EfiStatus = uint

  EfiHandle = pointer

  EfiTableHeader = object
    signature: uint64
    revision: uint32
    headerSize: uint32
    crc32: uint32
    reserved: uint32

  EfiSystemTable = object
    header: EfiTableHeader
    firmwareVendor: WideCString
    firmwareRevision: uint32
    consoleInHandle: EfiHandle
    conIn: pointer
    consoleOutHandle: EfiHandle
    conOut: ptr SimpleTextOutputProtocol
    standardErrorHandle: EfiHandle
    stdErr: pointer
    runtimeServices: pointer
    bootServices: pointer
    numTableEntries: uint
    configTable: pointer
  
  SimpleTextOutputProtocol = object
    reset: pointer
    outputString: proc (this: ptr SimpleTextOutputProtocol, str: WideCString): EfiStatus {.cdecl.}
    testString: pointer
    queryMode: pointer
    setMode: pointer
    setAttribute: pointer
    clearScreen: proc (this: ptr SimpleTextOutputProtocol): EfiStatus {.cdecl.}
    setCursorPos: pointer
    enableCursor: pointer
    mode: ptr pointer

const
  EfiSuccess = 0
  EfiLoadError = 1
```

We're particularly interested in the `conOut` field, which is a pointer to the console output interface `SimpleTextOutputProtocol`. We'll use this to clear the screen (using the `clearScreen` function) and print to the screen (using the `outputString` function).

## Printing to the screen

Let's start by clearing the screen. To avoid returning to the UEFI shell, we'll call the `quit` function, which eventually calls the `exit` function we implemented earlier, which halts the CPU.

```nim
# src/bootx64.nim
...

proc EfiMain(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  NimMain()
  discard sysTable.conOut.clearScreen(sysTable.conOut)
  quit()
```

When we compile and load this in QEMU, we see a blank screen, as expected.

Next, let's print a simple message to the screen. We'll use the `outputString` function, which takes a pointer to a null-terminated UTF-16 string. Nim supports UTF-16 strings through the `Utf16Char` and `WideCString` types. Before we start using `WideCString`, I want to highlight a difference in how Nim declares this type in the presence of a `nimv2` flag. Without this flag, Nim defines `WideCString` as a `ref UnchekcedArray[Utf16Char]`:

```nim
    type
      WideCString* = ref UncheckedArray[Utf16Char]
      WideCStringObj* = WideCString
```

With the `nimv2` flag, Nim defines `WideCString` as a `ptr UncheckedArray[Utf16Char]`:

```nim
    type
      WideCString* = ptr UncheckedArray[Utf16Char]
      WideCStringObj* = object
        bytes: int
        data: WideCString
```

Since we're going to pass a pointr to a null-terminated UTF-16 string to `outputString`, we need to use the `ptr` version of `WideCString`. So let's add the `nimv2` flag to our `nim.cfg`:

```properties
# nim.cfg

-d:nimv2
```

We create a wide string using `newWideCString` (which returns a `WideCStringObj`), use the `toWideCString` converter to get access to the underlying data buffer, and then pass it to `outputString`.

```nim
# src/bootx64.nim

proc EfiMain(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  NimMain()

  let msg = newWideCString("Hello, world!\n").toWideCString

  discard sysTable.conOut.clearScreen(sysTable.conOut)
  discard sysTable.conOut.outputString(sysTable.conOut, msg)

  quit(0)
```

When we compile and load this in QEMU, we see the message printed to the screen, as expected.

![Bootloader Hello World](bootloader-hello-world.png)
