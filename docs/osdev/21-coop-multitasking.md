# Cooperative Multitasking

The idea of cooperative multitasking is that, at certain points in the task's execution, it voluntarily yields control back to the kernel. This is done by invoking a system call, typically called `yield`. In other cases, if the task invokes a system call that blocks, this is also considered a yield. The kernel then decides which task to run next, and returns control to that task.

The advantage of cooperative multitasking is that it is very simple to implement. The disadvantage is that if a task does not yield, it will never be preempted. This means that a single task can monopolize the CPU, and the system will become unresponsive. In **preemptive multitasking**, the kernel uses a timer to interrupt the currently running task, and preempt it if its time slice has expired, or if a higher priority task is ready to run. This ensures that no task can monopolize the CPU. We'll see how to implement preemptive multitasking later.

## Scheduling

We'll add a new kernel component called the **scheduler**. The scheduler is responsible for keeping track of all the tasks in the system, and deciding which task to run next. It is invoked by the kernel at certain points, such as when a task yields or blocks.

Let's start by creating a new module called `sched.nim` in the `kernel` directory. 

## Context Switching

When switching between tasks, the scheduler needs to save the state of the currently running task, and restore the state of the task that is about to run. This is called a **context switch**. The task state typically includes the CPU registers, the stack pointer, and the instruction pointer.
