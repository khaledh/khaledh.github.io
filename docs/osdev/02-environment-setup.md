# Environment Setup

In this section, we'll set up our development environment. We'll be using **Nim** as our programming language, so obviously we'll need to install the **Nim compiler**. We also need a way to cross-compile to a freestanding environment. We'll use LLVM's **clang** and **lld** for that. Finally, we'll need a way to test our OS. We'll use **QEMU** for that.

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

## LLVM toolchain

Now that we have Nim installed, we need to install the **LLVM** toolchain. We'll use **clang** and **lld** to cross-compile to a freestanding environment.

```sh-session
$ sudo pacman -S clang lld
...

$ clang --version
clang version 16.0.6
...

$ ld.lld --version
LLD 16.0.6 (compatible with GNU linkers)
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
