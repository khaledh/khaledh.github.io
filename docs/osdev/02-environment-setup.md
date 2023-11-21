# Environment Setup

In this section, we'll set up our development environment. We'll be using **Nim** as our programming language, so we'll need to install the **Nim compiler** and a **cross-compiler** for our target platform. We'll also need **QEMU** to test our OS.

## Nim compiler

First, we need to install the **Nim compiler**. An easy way to install Nim is through the **choosenim** installer, so let's install that first:

```sh-session
$ curl https://nim-lang.org/choosenim/init.sh -sSf | sh
```

Then, we can install the latest stable version of Nim:

```sh-session
$ choosenim stable
Downloading Nim 2.0.0 from nim-lang.org
...

$ nim -v
Nim Compiler Version 2.0.0 [Linux: amd64]
...
```

## C Cross-compiler

Now that we have Nim installed, we need to install a C cross-compiler for our target platform. Since we'll be targeting **UEFI** as our boot environment, we'll need a compiler/linker that generates **PE32+** binaries (as required by the UEFI spec). The easiest way to get this is to use the **MinGW-w64** toolchain. I'm on Arch Linux, so I can install it with:

```sh-session
$ sudo pacman -S mingw-w64-gcc
...

$ x86_64-w64-mingw32-gcc -dumpversion
12.2.0
```

## QEMU

Next, let's install **QEMU** so that we can test our OS:

```sh-session
$ sudo pacman -S qemu-desktop
...

$ qemu-system-x86_64 --version
QEMU emulator version 8.1.2
...
```

## Creating the project

Now that we have our environment set up, we can create our project. We'll start by creating a new directory for our project:

```sh-session
$ mkdir fusion && cd fusion
```

Next, we'll create a new **nimble** project with binary package type:

```sh-session
$ nimble init
...
    Prompt: Package type?
        ... Library - provides functionality for other packages.
        ... Binary  - produces an executable for the end-user.
        ... Hybrid  - combination of library and binary
        ... For more information see https://goo.gl/cm2RX5
     Select Cycle with 'Tab', 'Enter' when done
    Answer: binary
...
```

Let's also create a `build` directory for our build artifacts and add it to `.gitignore`:

```sh-session
$ mkdir build
$ echo build >> .gitignore
```

In the next section, we'll start writing our bootloader.
