# Writing an OS in Nim

## Introduction

I decided to document my journey of writing an OS in Nim. Why Nim? It's one of the few languages
that allow low-level systems programming with deterministic memory management (garbage collector is optional) with destructors and move semantics. It's also statically typed, which provides greater type safety. It also supports inline assembly, which is a must for OS development.  Other options include C, C++, Rust, and Zig. They're great languages, but I chose Nim for its simplicity, elegance, and performance.

Let's get started!

## Fusion OS

As any hobby OS project, it needs a name. I decided to call it **Fusion OS**, for no particular reason. I just like the name :-) This is not going to be a Unix-like OS. I'd like to experiment with some ideas that I think would be interesting to explore. Here are some of the features I'd like to implement:

**Single Address Space**
: <p>This basically means that all processes share a single 64-bit virtual address space. I may still use per-process page tables for memory protection, but the address space will be shared.</p>

**Capability-based Security**
: <p>This is a security model where access to resources is controlled by capabilities, which are unforgeable tokens that grant access to a resource. In addition to typical resources (e.g. files, devices, etc.), virtual memory regions will also be treated as resources, and access to them will be controlled by capabilities.</p>

**Computations as State Machines**
: <p>Kernel services, interrupt handlers, and user processes will be implemented as single-threaded state machines. Concurrency will be achieved by running multiple state machines in parallel.</p>

**Message Passing**
: <p>State machines will communicate with each other by sending messages (think events/commands), both synchronously and asynchronously.</p>

**Memory Mapped Filesystem**
: <p>The filesystem will be memory mapped into the address space, so that files can be accessed as memory. This will allow for zero-copy file I/O.</p>

In the next section, we'll set up our development environment.

<!--
---
<CommentService />
-->
