# User Space

User space is the space in memory where user programs run. In the previous section we mapped the kernel to the higher half of the x64 virtual address space (**kernel space**). User programs will run in the lower half (**user space**), i.e. the addresses from `0x0000000000000000` to `0x00007FFFFFFFFFFF` (128 TiB). Any virtual pages mapped in this area will be accessible to user programs (as well as the kernel). Pages in the kernel space will only be accessible to the kernel.

In addition to restricted access to memory, user programs also run in a restricted CPU mode called **user mode**. In this mode, the CPU will not allow the program to execute privileged instructions. This protects the integrity of the kernel. In order to execute privileged instructions, the program must first switch to **kernel mode**. This is done through **system calls**, which enter the kernel at predefined entry points. After validating the system call arguments, the kernel will execute the requested privileged instruction in kernel mode on behalf of the user program, and then return to user mode.

To keep things simple at the beginning, I won't focus on system calls for now. So here's the plan:

