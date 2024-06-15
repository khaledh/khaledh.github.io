# ELF Loader (Part 1)

So far we used a flat binary format for our user task. But it's becoming more difficult as we have
to manually specify the layout of the binary using a linker script, and arrange the sections in a
fixed way so that the kernel can load them, apply relocations, and jump to the entry point. We also
haven't told the kernel what sections should be marked as read-only, read-write, and/or executable.
This is where the ELF format comes in.

ELF is a self-describing format that contains all the information needed to load and run a program.
Although implementing an ELF loader is more complex than a flat binary loader, it's more flexible
and and will save us a lot of time in the long run. Let's go ahead and implement an ELF loader.

## ELF Format

ELF files contain executable code and data, as well as metadata about the file so that the loader
can load the file into memory and run it. The parts of the ELF format that are relevant to us are:

**ELF Header**
: Contains metadata about the file, such as the target architecture, the entry point,
and the offsets of the other sections.

**Program Header Table**
: Contains a list of segments to be loaded into memory. Each segment can contain one or more sections.

**Section Header Table**
: Contains a list of sections, which are used for debugging and linking.

**Sections**
: Contains the actual code and data of the program.

**Symbol Table**
: Contains information about the symbols in the program.

**String Table**
: Contains strings used by the symbol table.

**Relocation Table**
: Contains information about the relocations to be applied to the program.

## Building an ELF binary

Let's modify our user program to build an ELF binary instead of a flat binary. We previously used a
linker script to have control over the binary layout, such that the kernel could load the binary in
a straightforward way. To produce an ELF binary, we'll simply remove the linker script and let the
compiler and linker generate a default ELF binary.

```sh-session
$ rm src/user/linker.ld
$ just user
$ file build/user/utask.bin
build/user/utask.bin: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, not stripped
```

Looks good. Let's inspect the ELF binary using `readelf`.

```sh-session
$ readelf -eW build/user/utask.bin
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              DYN (Position-Independent Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0xf5f0
  Start of program headers:          64 (bytes into file)
  Start of section headers:          78256 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         8
  Size of section headers:           64 (bytes)
  Number of section headers:         18
  Section header string table index: 16

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .dynsym           DYNSYM          0000000000000200 000200 000018 18   A  4   1  8
  [ 2] .gnu.hash         GNU_HASH        0000000000000218 000218 00001c 00   A  1   0  8
  [ 3] .hash             HASH            0000000000000234 000234 000010 04   A  1   0  4
  [ 4] .dynstr           STRTAB          0000000000000244 000244 000001 00   A  0   0  1
  [ 5] .rela.dyn         RELA            0000000000000248 000248 000498 18   A  1   0  8
  [ 6] .rodata           PROGBITS        00000000000006e0 0006e0 000ea8 00 AMS  0   0 16
  [ 7] .text             PROGBITS        0000000000002590 001590 00d712 00  AX  0   0 16
  [ 8] .data.rel.ro      PROGBITS        0000000000010cb0 00ecb0 000270 00  WA  0   0 16
  [ 9] .dynamic          DYNAMIC         0000000000010f20 00ef20 0000d0 10  WA  4   0  8
  [10] .got              PROGBITS        0000000000010ff0 00eff0 000000 00  WA  0   0  8
  [11] .relro_padding    NOBITS          0000000000010ff0 00eff0 000010 00  WA  0   0  1
  [12] .data             PROGBITS        0000000000011ff0 00eff0 000118 00  WA  0   0  8
  [13] .bss              NOBITS          0000000000012110 00f108 200490 00  WA  0   0 16
  [14] .comment          PROGBITS        0000000000000000 00f108 00003e 01  MS  0   0  1
  [15] .symtab           SYMTAB          0000000000000000 00f148 001f38 18     17 332  8
  [16] .shstrtab         STRTAB          0000000000000000 011080 000091 00      0   0  1
  [17] .strtab           STRTAB          0000000000000000 011111 002099 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  D (mbind), l (large), p (processor specific)

Program Headers:
  Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
  PHDR           0x000040 0x0000000000000040 0x0000000000000040 0x0001c0 0x0001c0 R   0x8
  LOAD           0x000000 0x0000000000000000 0x0000000000000000 0x001588 0x001588 R   0x1000
  LOAD           0x001590 0x0000000000002590 0x0000000000002590 0x00d712 0x00d712 R E 0x1000
  LOAD           0x00ecb0 0x0000000000010cb0 0x0000000000010cb0 0x000340 0x000350 RW  0x1000
  LOAD           0x00eff0 0x0000000000011ff0 0x0000000000011ff0 0x000118 0x2005b0 RW  0x1000
  DYNAMIC        0x00ef20 0x0000000000010f20 0x0000000000010f20 0x0000d0 0x0000d0 RW  0x8
  GNU_RELRO      0x00ecb0 0x0000000000010cb0 0x0000000000010cb0 0x000340 0x000350 R   0x1
  GNU_STACK      0x000000 0x0000000000000000 0x0000000000000000 0x000000 0x000000 RW  0

 Section to Segment mapping:
  Segment Sections...
   00     
   01     .dynsym .gnu.hash .hash .dynstr .rela.dyn .rodata 
   02     .text 
   03     .data.rel.ro .dynamic .relro_padding 
   04     .data .bss 
   05     .dynamic 
   06     .data.rel.ro .dynamic .relro_padding 
   07     
```

We can see there are many sections and serveral segments. The last part shows how the sections are
mapped to the segments. We are mainly interested in the segments of type `LOAD`, which are the ones
to be loaded into memory. We also need the `DYNAMIC` segment for applying relocations. The nice
thing here is that we don't need to worry about which section is code, data, or bss. The segments
include a flags field that tells us the permissions of the segment (read, write, execute). We'll use
this information to set the correct permissions on the virtual memory regions.

Notice also that the `VirtAddr` of some segments doesn't necessarily start on a page boundary.
However, their `Align` field tells us that the first page of the segment should be aligned to a page
boundary (I'm making a simplifying assumption here that `Align` values are always equal to x86-64's page size, i.e. 4KiB). Thus, a segment's start page is the segment's `VirtAddr` rounded down to the nearest page boundary.

## ELF Reader

To keep the loader simple, we'll implement a separate ELF reader module that provides an interface
to iterate over the sections and segments of an ELF file. Let's add a new file `elf.nim` to the
`kernel` directory, which will contain the various types and procedures needed to read an ELF file.

We'll start by defining an `ElfImage` and `ElfHeader` types, along with supporting types.

```nim
# src/kernel/elf.nim

type
  ElfImage = object
    header: ptr ElfHeader

  ElfHeader {.packed.} = object
    ident: ElfIdent
    `type`: ElfType
    machine: ElfMachine
    version: uint32
    entry: uint64
    phoff: uint64
    shoff: uint64
    flags: uint32
    ehsize: uint16
    phentsize: uint16
    phnum: uint16
    shentsize: uint16
    shnum: uint16
    shstrndx: uint16

  ElfIdent {.packed.} = object
    magic: array[4, char]
    class: ElfClass
    endianness: ElfEndianness
    version: ElfVersion
    osabi: uint8
    abiversion: uint8
    pad: array[7, uint8]

  ElfClass = enum
    None = (0, "None")
    Bits32 = (1, "32-bit")
    Bits64 = (2, "64-bit")

  ElfEndianness = enum
    None = (0, "None")
    Little = (1, "Little-endian")
    Big = (2, "Big-endian")

  ElfVersion = enum
    None = (0, "None")
    Current = (1, "Current")

  ElfType {.size: sizeof(uint16).} = enum
    None = (0, "Unknown")
    Relocatable = (1, "Relocatable")
    Executable = (2, "Executable")
    Shared = (3, "Shared object")
    Core = (4, "Core")
  
  ElfMachine {.size: sizeof(uint16).} = enum
    None = (0, "None")
    Sparc = (0x02, "Sparc")
    X86 = (0x03, "x86")
    Mips = (0x08, "MIPS")
    PowerPC = (0x14, "PowerPC")
    ARM = (0x28, "Arm")
    Sparc64 = (0x2b, "Sparc64")
    IA64 = (0x32, "IA-64")
    X86_64 = (0x3e, "x86-64")
    AArch64 = (0xb7, "AArch64")
    RiscV = (0xf3, "RISC-V")
```

This should be straightforward. The following fields in `ElfHeader` are relevant to us:

- `entry`: The virtual address of the entry point. We'll use this to jump to the user task once it's
  loaded.
- `phoff`: The offset of the program header table.
- `phentsize`: The size of each entry in the program header table.
- `phnum`: The number of entries in the program header table.
- `shoff`: The offset of the section header table.
- `shentsize`: The size of each entry in the section header table.
- `shnum`: The number of entries in the section header table.
- `shstrndx`: The index of the section header table entry that contains the section names.

Next, let's define the `ElfProgramHeader` type.

```nim
type
  ElfProgramHeader {.packed.} = object
    `type`: ElfProgramHeaderType
    flags: ElfProgramHeaderFlags
    offset: uint64
    vaddr: uint64
    paddr: uint64
    filesz: uint64
    memsz: uint64
    align: uint64

  ElfProgramHeaderType {.size: sizeof(uint32).} = enum
    Null = (0, "NULL")
    Load = (1, "LOAD")
    Dynamic = (2, "DYNAMIC")
    Interp = (3, "INTERP")
    Note = (4, "NOTE")
    ShLib = (5, "SHLIB")
    Phdr = (6, "PHDR")
    Tls = (7, "TLS")
  
  ElfProgramHeaderFlag = enum
    Executable = (0, "E")
    Writable   = (1, "W")
    Readable   = (2, "R")
  ElfProgramHeaderFlags {.size: sizeof(uint32).} = set[ElfProgramHeaderFlag]
```

The `ElfProgramHeader` type contains the following fields:

- `type`: The type of the segment. We're only interested in `LOAD` segments (to be loaded into
  memory) and `DYNAMIC` segments (for applying relocations).
- `flags`: The permissions of the segment. We'll use this to mark the segments as read-only,
  read-write, or executable.
- `offset`: The offset of the segment in the file.
- `vaddr`: The virtual address of the segment. This is the address where the segment should be
  loaded into memory relative to the base address.
- `paddr`: The physical address of the segment. This is not used in our case.
- `filesz`: The size of the segment in the file.
- `memsz`: The size of the segment in memory. This can be larger than `filesz` if the segment
  contains uninitialized data (e.g. `bss` section).
- `align`: The alignment of the segment in memory.

Next, let's define the `ElfSectionHeader` type.

```nim
type
  ElfSectionHeader {.packed.} = object
    nameoffset: uint32
    `type`: ElfSectionType
    flags: uint64
    vaddr: uint64
    offset: uint64
    size: uint64
    link: uint32
    info: uint32
    addralign: uint64
    entsize: uint64
  
  ElfSectionType {.size: sizeof(uint32).} = enum
    Null = (0, "NULL")
    ProgBits = (1, "PROGBITS")
    SymTab = (2, "SYMTAB")
    StrTab = (3, "STRTAB")
    Rela = (4, "RELA")
    Hash = (5, "HASH")
    Dynamic = (6, "DYNAMIC")
    Note = (7, "NOTE")
    NoBits = (8, "NOBITS")
    Rel = (9, "REL")
    ShLib = (10, "SHLIB")
    DynSym = (11, "DYNSYM")
    InitArray = (14, "INIT_ARRAY")
    FiniArray = (15, "FINI_ARRAY")
    PreInitArray = (16, "PREINIT_ARRAY")
    Group = (17, "GROUP")
    SymTabShndx = (18, "SYMTAB_SHNDX")
```

Sections are mostly relevant to the linker, not the loader (which deals with segments). I'm just
including it for the sake of completeness.

Now, let's add a proc to initialize an `ElfImage` object from a pointer to the ELF image in memory.
We'll validate some assumptions about the ELF image (e.g. the magic number, the architecture, etc.)
and raise an error if the image is not a valid ELF file or if it doesn't meet our expectations.

```nim
type
  InvalidElfImage = object of CatchableError
  UnsupportedElfImage = object of CatchableError

proc initElfImage(image: pointer): ElfImage =
  result.header = cast[ptr ElfHeader](image)

  if result.header.ident.magic != [0x7f.char, 'E', 'L', 'F']:
    raise newException(InvalidElfImage, "Not an ELF file")

  if result.header.ident.class != ElfClass.Bits64:
    raise newException(UnsupportedElfImage, "Only 64-bit ELF files are supported")

  if result.header.ident.endianness != ElfEndianness.Little:
    raise newException(UnsupportedElfImage, "Only little-endian ELF files are supported")

  if result.header.ident.version != ElfVersion.Current:
    raise newException(UnsupportedElfImage, &"Only ELF version {ElfVersion.Current} is supported.")

  if result.header.type != ElfType.Shared:
    raise newException(UnsupportedElfImage, "Only PIE type ELF files are supported.")

  if result.header.machine != ElfMachine.X86_64:
    raise newException(UnsupportedElfImage, "Only x86-64 ELF files are supported.")
```

Next, let's add an iterator to iterate over the segments (i.e. program headers) of the ELF image.
The iterator will yield a tuple containing the index of the program header and the program header itself.

```nim
iterator segments(image: ElfImage): tuple[i: uint16, ph: ptr ElfProgramHeader] =
  let header = image.header

  let phoff = header.phoff
  let phentsize = header.phentsize
  let phnum = header.phnum

  for i in 0.uint16 ..< phnum:
    let ph = cast[ptr ElfProgramHeader](header +! (phoff + phentsize * i))
    yield (i, ph)
```

Similarily, let's add an iterator to iterate over the section headers of the ELF image.

```nim
iterator sections(image: ElfImage): tuple[i: uint16, sh: ptr ElfSectionHeader] =
  let header = image.header

  let shoff = header.shoff
  let shentsize = header.shentsize
  let shnum = header.shnum

  for i in 0.uint16 ..< shnum:
    let sh = cast[ptr ElfSectionHeader](header +! (shoff + shentsize * i))
    yield (i, sh)
```

That's it for the ELF reader. In the next part, we'll use this module to load the loadable segments
of an ELF file into memory, apply relocations, and jump to the entry point.
