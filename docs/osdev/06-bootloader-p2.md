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
    conOut: ptr SimpleTextOutput
    standardErrorHandle: EfiHandle
    stdErr: pointer
    runtimeServices: pointer
    bootServices: pointer
    numTableEntries: uint
    configTable: pointer
  
  SimpleTextOutput = object
    reset: pointer
    outputString: proc (this: ptr SimpleTextOutput, str: ptr Utf16Char): EfiStatus {.cdecl.}
    testString: pointer
    queryMode: pointer
    setMode: proc (this: ptr SimpleTextOutput, modeNum: uint): EfiStatus {.cdecl.}
    setAttribute: pointer
    clearScreen: proc (this: ptr SimpleTextOutput): EfiStatus {.cdecl.}
    setCursorPos: pointer
    enableCursor: pointer
    mode: ptr pointer

```

We're particularly interested in the `conOut` field, which is a pointer to the console output interface `SimpleTextOutput`. We'll use this to clear the screen (using the `clearScreen` function) and print to the screen (using the `outputString` function).

## Printing to the screen

Let's start by clearing the screen. To avoid returning to the UEFI shell, we'll call the `quit` function, which eventually calls the `exit` function we implemented earlier, which halts the CPU.

```nim
# src/bootx64.nim
...

proc main(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  NimMain()
  discard sysTable.conOut.clearScreen(sysTable.conOut)
  quit(0)
```

When we compile and load this in QEMU, we see a blank screen, as expected.

Next, let's print a simple message to the screen. We'll use the `outputString` function, which takes a pointer to a null-terminated UTF-16 string. Nim supports UTF-16 strings through the `Utf16Char` and `WideCString` types. We create a wide string using `newWideCString`, use `toWideCString` to get access to the underlying data buffer, and then pass a pointer to the string (i.e. the address of the first character) to `outputString`.

```nim
# src/bootx64.nim

proc main(imgHandle: EfiHandle, sysTable: ptr EFiSystemTable): EfiStatus {.exportc.} =
  NimMain()

  let msg = newWideCString("Hello, world!").toWideCString

  discard sysTable.conOut.clearScreen(sysTable.conOut)
  discard sysTable.conOut.outputString(sysTable.conOut, addr msg[0])

  quit(0)
```

When we compile and load this in QEMU, we see the message printed to the screen, as expected.

![Bootloader Hello World](bootloader-hello-world.png)
