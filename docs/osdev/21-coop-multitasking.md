# Cooperative Multitasking

The idea of cooperative multitasking is that, at certain points in the task's execution, it voluntarily yields control back to the kernel. This is done by invoking a system call, typically called `yield`. In other cases, if the task invokes a system call that blocks, this is also considered a yield. The kernel then decides which task to run next, and returns control to that task.

The advantage of cooperative multitasking is that it is very simple to implement. The disadvantage is that if a task does not yield, it will never be preempted. This means that a single task can monopolize the CPU, and the system will become unresponsive. In **preemptive multitasking**, the kernel uses a timer to interrupt the currently running task, and preempt it if its time slice has expired, or if a higher priority task is ready to run. This ensures that no task can monopolize the CPU. We'll see how to implement preemptive multitasking later.

## Scheduling

We'll add a new kernel component called the **scheduler**. The scheduler is responsible for keeping track of all the tasks in the system, and deciding which task to run next. It is invoked by the kernel at certain points, such as when a task yields or blocks. This means it needs to keep track of the currently running task, and the list of ready tasks. Upon invocation, it will decide which task to run next based on some strategy, and switch to that task. The simplest strategy is **round-robin** scheduling, where the scheduler simply runs each task in turn. There are many other strategies, but we'll start with round-robin.

To make it easy to manage the ready tasks, we'll use a **task queue**. The current task will be stored in a global variable, outside the queue. Here's how we're going to make scheduling decisions:

- When the scheduler is invoked (e.g. when a task yields), it will add the current task to the end of the queue, and then remove the first task from the queue, assign it to the current task, and switch to it.
- If the queue is empty, the scheduler will simply return, and the current task will continue running.
- When a task exits, we simply won't add it back to the queue, and the next task in the queue will be run.
- If a task exits and there are no more tasks in the queue, we'll simply halt the CPU.

Before we start implementing the scheduler, we need to make some changes to the `Task` type. We need to track the task **state**, which can be `New`, `Ready`, `Running`, or `Terminated` (for now). I'm also going to change the layout of the `Task` type by making the `rsp` field the first field, so that we can easily access it from inline assembly later. Here's the updated `tasks.nim` module:

```nim
# src/kernel/tasks.nim
type
  TaskState = enum
    New, Ready, Running, Terminated

  Task = object
    rsp: ptr uint64
    state: TaskState
    # other fields...
```

Let's start by creating a new module called `sched.nim` in the `kernel` directory. We'll define a task queue, a global variable to store the current task, and a proc to add a task to the queue:

```nim
# src/kernel/sched.nim
import std/deques

import tasks

var
  readyTasks = initDeque[Task]()
  currentTask* {.exportc.}: Task

proc addTask*(t: Task) =
  readyTasks.addLast(t)
```

If you remember, we already had defined a `currentTask` in the `tasks.nim` module. We'll make some changes to that module later when we get to context switching. I'm annotating `currentTask` with the `exportc` pragma since we'll need to access it from inline assembly later. Let's now add the main scheduler proc:

```nim
# src/kernel/sched.nim
...

proc schedule*() =
  if readyTasks.len == 0:
    if currentTask.isNil or currentTask.state == Terminated:
      debugln &"sched: no tasks to run, halting"
      halt()
    else:
      # no ready tasks, keep running the current task
      return

  if not (currentTask.isNil or currentTask.state == Terminated):
    # put the current task back into the queue
    currentTask.state = TaskState.Ready
    readyTasks.addLast(currentTask)

  # switch to the first task in the queue
  var nextTask = readyTasks.popFirst()
  
  switchTo(nextTask)
```

The current implementation of `switchTo` (in `tasks.nim`) only knows how to switch to a new task. We'll need to change it to perform an actual context switch.

## Context Switching

When switching between tasks, we need to save the state of the currently running task, and restore the state of the task that is about to run. The task state typically includes the CPU registers and the stack pointer. We don't need to save the instruction pointer, because once we swap the stack pointers, the old task resumes execution at the same point where its stack pointer was swapped out previously, and will continue as if nothing had happened. It's this swapping of stack pointers that causes the context switch.

Let's create a new module `ctxswitch.nim` to handle context switching. We'll move the `switchTo` proc from `tasks.nim` to `ctxswitch.nim`, and modify it to handle switching between tasks.

When the current task is not `nil` or terminated, we'll save its stack pointer and register state, regardless of whether we're switching to a new task or not. When we're switching to a new task, we'll simply load the new task's stack pointer and `iretq` to return to user mode. When we're switching to an existing task, we'll restore its stack pointer and register state and return normally.

Here's the modified `switchTo` proc:

```nim
# src/kernel/ctxswitch.nim
import cpu
import gdt
import tasks
import vmm

var
  currentTask {.importc.}: Task

proc switchTo*(next: var Task) =
  tss.rsp0 = next.kstack.bottom
  setActivePML4(next.space.pml4)

  if not (currentTask.isNil or currentTask.state == TaskState.Terminated):
    pushRegs()
    asm """
      mov %0, rsp
      : "=m" (`currentTask`->rsp)
    """

  currentTask = next

  case next.state
  of TaskState.New:
    next.state = TaskState.Running
    asm """
      mov rsp, %0
      iretq
      :
      : "m" (`currentTask`->rsp)
    """
  else:
    next.state = TaskState.Running
    asm """
      mov rsp, %0
      :
      : "m" (`currentTask`->rsp)
    """
    popRegs()
```

Let's define `pushRegs` and `popRegs`, but instead of defining them in this module, we'll put them in the `cpu.nim` module, where they belong. Here, I'll be using Nim templates instead of procs to avoid the overhead of calling a proc.

```nim
# src/kernel/cpu.nim

template pushRegs*() =
  asm """
    push rax
    push rbx
    push rcx
    push rdx
    push rsi
    push rdi
    push rbp
    push r8
    push r9
    push r10
    push r11
    push r12
    push r13
    push r14
    push r15
  """

template popRegs*() =
  asm """
    pop r15
    pop r14
    pop r13
    pop r12
    pop r11
    pop r10
    pop r9
    pop r8
    pop rbp
    pop rdi
    pop rsi
    pop rdx
    pop rcx
    pop rbx
    pop rax
  """
```

## `yield` System Call

To allow a task to yield control to the kernel, we'll add a new system call called `yield`. When a task invokes this system call, the kernel simply calls the scheduler to switch to the next task. Let's add it to the `syscall.nim` module:

```nim{4-6,12}
# src/kernel/syscalls.nim
...

proc `yield`*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln &"syscall: yield"
  schedule()

proc syscallInit*() =
  # set up syscall table
  syscallTable[1] = exit
  syscallTable[2] = print
  syscallTable[3] = `yield`
  ...
```

Notice that we have to quote the `yield` proc name because it's a reserved keyword in Nim. Now, tasks can invoke syscall 3 (with no arguments) to yield control to the kernel. Let's add this syscall to our user task:

```nim{11-13}
# src/user/utask.nim
...

proc UserMain*() {.exportc.} =
  NimMain()

  asm """
    # call print
    ...

    # call yield
    mov rdi, 3
    syscall

    # call exit
    ...
  """
```

The task now will print something, yield control to the kernel, and then exit.

## Handling Task Exits

When the current task calls the `exit` system call, we should also invoke the scheduler, but the task shouldn't be put back into the queue. We can do this by setting the task's state to `Terminated` before invoking the scheduler. Terminating a task may involve other steps later (e.g. freeing its memory), so let's add a `terminateTask` proc to the `tasks.nim` module:

```nim
# src/kernel/tasks.nim

proc terminateTask*(t: var Task) =
  t.state = TaskState.Terminated
  # other cleanup...
```

Now, let's modify the `exit` syscall to call `terminateTask` before invoking the scheduler:

```nim
# src/kernel/syscalls.nim

proc exit*(args: ptr SyscallArgs): uint64 {.cdecl.} =
  debugln &"syscall: exit: code={args.arg1}"
  terminateTask(currentTask)
  schedule()
```

## Running multiple tasks

Let's now create two user tasks, add them to the task queue, and invoke the scheduler.

```nim
# src/kernel/main.nim
...

proc KernelMainInner(bootInfo: ptr BootInfo) =
  ...

  debugln "kernel: Creating user tasks"
  var task1 = createTask(
    imagePhysAddr = bootInfo.userImagePhysicalBase.PhysAddr,
    imagePageCount = bootInfo.userImagePages,
  )
  var task2 = createTask(
    imagePhysAddr = bootInfo.userImagePhysicalBase.PhysAddr,
    imagePageCount = bootInfo.userImagePages,
  )

  debugln "kernel: Adding tasks to scheduler"
  sched.addTask(task1)
  sched.addTask(task2)

  debugln "kernel: Starting scheduler"
  sched.schedule()
```

Let's run it and see what happens.

```sh-session
kernel: Creating user tasks
kernel: Applying relocations to user image
kernel: Applying relocations to user image
kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -> 0
syscall: print
Hello from user mode!
syscall: yield
sched: switching 0 -> 1
syscall: print
Hello from user mode!
syscall: yield
sched: switching 1 -> 0
syscall: exit: code=0
sched: switching 0 -> 1
syscall: exit: code=0
sched: no tasks to run, halting
```

It works! The scheduler first runs task 0, which prints a message, then yields control to the kernel. The scheduler then switches to task 1, which prints another message, and then yields control back to the kernel. The scheduler then switches back to task 0, which calls `exit`, which terminates the task. The scheduler then switches to task 1, which also calls `exit` and terminates the task. Since there are no more tasks in the queue, the scheduler halts the CPU.

Let's add a third task for fun and see what happens.

```sh-session
kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -> 0
syscall: print
Hello from user mode!
syscall: yield
sched: switching 0 -> 1
syscall: print
Hello from user mode!
syscall: yield
sched: switching 1 -> 2
syscall: print
Hello from user mode!
syscall: yield
sched: switching 2 -> 0
syscall: exit: code=0
sched: switching 0 -> 1
syscall: exit: code=0
sched: switching 1 -> 2
syscall: exit: code=0
sched: no tasks to run, halting
```

It works! The scheduler runs all three tasks in a round-robin fashion, and then halts the CPU when there are no more tasks to run. This is exciting! We now have a simple cooperative multitasking system.

Now that we have a few system calls, it's time to add a system library that can be used by user tasks to invoke these system calls, instead of using inline assembly. We'll do that in the next chapter.
