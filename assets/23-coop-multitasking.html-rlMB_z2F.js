import{_ as s,o as n,c as e,e as a}from"./app-IpIrRMej.js";const t={},i=a(`<h1 id="cooperative-multitasking" tabindex="-1"><a class="header-anchor" href="#cooperative-multitasking" aria-hidden="true">#</a> Cooperative Multitasking</h1><p>The idea of cooperative multitasking is that, at certain points in the task&#39;s execution, it voluntarily yields control back to the kernel. This is done by invoking a system call, typically called <code>yield</code>. In other cases, if the task invokes a system call that blocks, this is also considered a yield. The kernel then decides which task to run next, and returns control to that task.</p><p>The advantage of cooperative multitasking is that it is very simple to implement. The disadvantage is that if a task does not yield, it will never be preempted. This means that a single task can monopolize the CPU, and the system will become unresponsive. In <strong>preemptive multitasking</strong>, the kernel uses a timer to interrupt the currently running task, and preempt it if its time slice has expired, or if a higher priority task is ready to run. This ensures that no task can monopolize the CPU. We&#39;ll see how to implement preemptive multitasking later.</p><h2 id="scheduling" tabindex="-1"><a class="header-anchor" href="#scheduling" aria-hidden="true">#</a> Scheduling</h2><p>We&#39;ll add a new kernel component called the <strong>scheduler</strong>. The scheduler is responsible for keeping track of all the tasks in the system, and deciding which task to run next. It is invoked by the kernel at certain points, such as when a task yields or blocks. This means it needs to keep track of the currently running task, and the list of ready tasks. Upon invocation, it will decide which task to run next based on some strategy, and switch to that task. The simplest strategy is <strong>round-robin</strong> scheduling, where the scheduler simply runs each task in turn. There are many other strategies, but we&#39;ll start with round-robin.</p><p>To make it easy to manage the ready tasks, we&#39;ll use a <strong>task queue</strong>. The current task will be stored in a global variable, outside the queue. Here&#39;s how we&#39;re going to make scheduling decisions:</p><ul><li>When the scheduler is invoked (e.g. when a task yields), it will add the current task to the end of the queue, and then remove the first task from the queue, assign it to the current task, and switch to it.</li><li>If the queue is empty, the scheduler will simply return, and the current task will continue running.</li><li>When a task exits, we simply won&#39;t add it back to the queue, and the next task in the queue will be run.</li><li>If a task exits and there are no more tasks in the queue, we&#39;ll simply halt the CPU.</li></ul><p>Before we start implementing the scheduler, we need to make some changes to the <code>Task</code> type. We need to track the task <strong>state</strong>, which can be <code>New</code>, <code>Ready</code>, <code>Running</code>, or <code>Terminated</code> (for now). I&#39;m also going to change the layout of the <code>Task</code> type by making the <code>rsp</code> field the first field, so that we can easily access it from inline assembly later. Here&#39;s the updated <code>tasks.nim</code> module:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>
<span class="token keyword">type</span>
  TaskState <span class="token operator">=</span> <span class="token keyword">enum</span>
    New<span class="token punctuation">,</span> Ready<span class="token punctuation">,</span> Running<span class="token punctuation">,</span> Terminated

  Task <span class="token operator">=</span> <span class="token keyword">object</span>
    rsp<span class="token operator">:</span> <span class="token keyword">ptr</span> uint64
    state<span class="token operator">:</span> TaskState
    <span class="token comment"># other fields...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s start by creating a new module called <code>sched.nim</code> in the <code>kernel</code> directory. We&#39;ll define a task queue, a global variable to store the current task, and a proc to add a task to the queue:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/sched.nim</span>
<span class="token keyword">import</span> std<span class="token operator">/</span>deques

<span class="token keyword">import</span> tasks

<span class="token keyword">var</span>
  readyTasks <span class="token operator">=</span> <span class="token function">initDeque[Task]</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  currentTask<span class="token operator">*</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span><span class="token operator">:</span> Task

<span class="token keyword">proc</span> <span class="token function">addTask<span class="token operator">*</span></span><span class="token punctuation">(</span>t<span class="token operator">:</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span>
  readyTasks<span class="token operator">.</span><span class="token function">addLast</span><span class="token punctuation">(</span>t<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If you remember, we already had defined a <code>currentTask</code> in the <code>tasks.nim</code> module. We&#39;ll make some changes to that module later when we get to context switching. I&#39;m annotating <code>currentTask</code> with the <code>exportc</code> pragma since we&#39;ll need to access it from inline assembly later. Let&#39;s now add the main scheduler proc:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/sched.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">schedule<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">if</span> readyTasks<span class="token operator">.</span>len <span class="token operator">==</span> <span class="token number">0</span><span class="token operator">:</span>
    <span class="token keyword">if</span> currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> Terminated<span class="token operator">:</span>
      debugln <span class="token operator">&amp;</span><span class="token string">&quot;sched: no tasks to run, halting&quot;</span>
      <span class="token function">halt</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token keyword">else</span><span class="token operator">:</span>
      <span class="token comment"># no ready tasks, keep running the current task</span>
      <span class="token keyword">return</span>

  <span class="token keyword">if</span> <span class="token function">not</span> <span class="token punctuation">(</span>currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> Terminated<span class="token punctuation">)</span><span class="token operator">:</span>
    <span class="token comment"># put the current task back into the queue</span>
    currentTask<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Ready
    readyTasks<span class="token operator">.</span><span class="token function">addLast</span><span class="token punctuation">(</span>currentTask<span class="token punctuation">)</span>

  <span class="token comment"># switch to the first task in the queue</span>
  <span class="token keyword">var</span> nextTask <span class="token operator">=</span> readyTasks<span class="token operator">.</span><span class="token function">popFirst</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  
  <span class="token function">switchTo</span><span class="token punctuation">(</span>nextTask<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The current implementation of <code>switchTo</code> (in <code>tasks.nim</code>) only knows how to switch to a new task. We&#39;ll need to change it to perform an actual context switch.</p><h2 id="context-switching" tabindex="-1"><a class="header-anchor" href="#context-switching" aria-hidden="true">#</a> Context Switching</h2><p>When switching between tasks, we need to save the state of the currently running task, and restore the state of the task that is about to run. The task state typically includes the CPU registers and the stack pointer. We don&#39;t need to save the instruction pointer, because once we swap the stack pointers, the old task resumes execution at the same point where its stack pointer was swapped out previously, and will continue as if nothing had happened. It&#39;s this swapping of stack pointers that causes the context switch.</p><p>Let&#39;s create a new module <code>ctxswitch.nim</code> to handle context switching. We&#39;ll move the <code>switchTo</code> proc from <code>tasks.nim</code> to <code>ctxswitch.nim</code>, and modify it to handle switching between tasks.</p><p>When the current task is not <code>nil</code> or terminated, we&#39;ll save its stack pointer and register state, regardless of whether we&#39;re switching to a new task or not. When we&#39;re switching to a new task, we&#39;ll simply load the new task&#39;s stack pointer and <code>iretq</code> to return to user mode. When we&#39;re switching to an existing task, we&#39;ll restore its stack pointer and register state and return normally.</p><p>Here&#39;s the modified <code>switchTo</code> proc:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/ctxswitch.nim</span>
<span class="token keyword">import</span> cpu
<span class="token keyword">import</span> gdt
<span class="token keyword">import</span> tasks
<span class="token keyword">import</span> vmm

<span class="token keyword">var</span>
  currentTask <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span><span class="token operator">:</span> Task

<span class="token keyword">proc</span> <span class="token function">switchTo<span class="token operator">*</span></span><span class="token punctuation">(</span>next<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span>
  tss<span class="token operator">.</span>rsp0 <span class="token operator">=</span> next<span class="token operator">.</span>kstack<span class="token operator">.</span>bottom
  <span class="token function">setActivePML4</span><span class="token punctuation">(</span>next<span class="token operator">.</span>space<span class="token operator">.</span>pml4<span class="token punctuation">)</span>

  <span class="token keyword">if</span> <span class="token function">not</span> <span class="token punctuation">(</span>currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> TaskState<span class="token operator">.</span>Terminated<span class="token punctuation">)</span><span class="token operator">:</span>
    <span class="token function">pushRegs</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
      mov %0, rsp
      : &quot;=m&quot; (\`currentTask\`-&gt;rsp)
    &quot;&quot;&quot;</span>

  currentTask <span class="token operator">=</span> next

  <span class="token keyword">case</span> next<span class="token operator">.</span>state
  <span class="token operator">of</span> TaskState<span class="token operator">.</span>New<span class="token operator">:</span>
    next<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Running
    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
      mov rsp, %0
      iretq
      :
      : &quot;m&quot; (\`currentTask\`-&gt;rsp)
    &quot;&quot;&quot;</span>
  <span class="token keyword">else</span><span class="token operator">:</span>
    next<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Running
    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
      mov rsp, %0
      :
      : &quot;m&quot; (\`currentTask\`-&gt;rsp)
    &quot;&quot;&quot;</span>
    <span class="token function">popRegs</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s define <code>pushRegs</code> and <code>popRegs</code>, but instead of defining them in this module, we&#39;ll put them in the <code>cpu.nim</code> module, where they belong. Here, I&#39;ll be using Nim templates instead of procs to avoid the overhead of calling a proc.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/cpu.nim</span>

<span class="token keyword">template</span> <span class="token function">pushRegs<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
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
  &quot;&quot;&quot;</span>

<span class="token keyword">template</span> <span class="token function">popRegs<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
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
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="yield-system-call" tabindex="-1"><a class="header-anchor" href="#yield-system-call" aria-hidden="true">#</a> <code>yield</code> System Call</h2><p>To allow a task to yield control to the kernel, we&#39;ll add a new system call called <code>yield</code>. When a task invokes this system call, the kernel simply calls the scheduler to switch to the next task. Let&#39;s add it to the <code>syscall.nim</code> module:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">\`yield\`<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: yield&quot;</span>
  <span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token comment"># set up syscall table</span>
  syscallTable<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> exit
  syscallTable<span class="token punctuation">[</span><span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">=</span> print
  syscallTable<span class="token punctuation">[</span><span class="token number">3</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token identifier"><span class="token punctuation">\`</span>yield<span class="token punctuation">\`</span></span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that we have to quote the <code>yield</code> proc name because it&#39;s a reserved keyword in Nim. Now, tasks can invoke syscall 3 (with no arguments) to yield control to the kernel. Let&#39;s add this syscall to our user task:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # call print
    ...

    # call yield
    mov rdi, 3
    syscall

    # call exit
    ...
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The task now will print something, yield control to the kernel, and then exit.</p><h2 id="handling-task-exits" tabindex="-1"><a class="header-anchor" href="#handling-task-exits" aria-hidden="true">#</a> Handling Task Exits</h2><p>When the current task calls the <code>exit</code> system call, we should also invoke the scheduler, but the task shouldn&#39;t be put back into the queue. We can do this by setting the task&#39;s state to <code>Terminated</code> before invoking the scheduler. Terminating a task may involve other steps later (e.g. freeing its memory), so let&#39;s add a <code>terminateTask</code> proc to the <code>tasks.nim</code> module:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>

<span class="token keyword">proc</span> <span class="token function">terminateTask<span class="token operator">*</span></span><span class="token punctuation">(</span>t<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span>
  t<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Terminated
  <span class="token comment"># other cleanup...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s modify the <code>exit</code> syscall to call <code>terminateTask</code> before invoking the scheduler:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">proc</span> <span class="token function">exit<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: exit: code={args.arg1}&quot;</span>
  <span class="token function">terminateTask</span><span class="token punctuation">(</span>currentTask<span class="token punctuation">)</span>
  <span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="running-multiple-tasks" tabindex="-1"><a class="header-anchor" href="#running-multiple-tasks" aria-hidden="true">#</a> Running multiple tasks</h2><p>Let&#39;s now create two user tasks, add them to the task queue, and invoke the scheduler.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  debugln <span class="token string">&quot;kernel: Creating user tasks&quot;</span>
  <span class="token keyword">var</span> task1 <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span>
    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span>
    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span>
  <span class="token punctuation">)</span>
  <span class="token keyword">var</span> task2 <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span>
    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span>
    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span>
  <span class="token punctuation">)</span>

  debugln <span class="token string">&quot;kernel: Adding tasks to scheduler&quot;</span>
  sched<span class="token operator">.</span><span class="token function">addTask</span><span class="token punctuation">(</span>task1<span class="token punctuation">)</span>
  sched<span class="token operator">.</span><span class="token function">addTask</span><span class="token punctuation">(</span>task2<span class="token punctuation">)</span>

  debugln <span class="token string">&quot;kernel: Starting scheduler&quot;</span>
  sched<span class="token operator">.</span><span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s run it and see what happens.</p><div class="language-sh-session line-numbers-mode" data-ext="sh-session"><pre class="language-sh-session"><code><span class="token output">kernel: Creating user tasks
kernel: Applying relocations to user image
kernel: Applying relocations to user image
kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -&gt; 0
syscall: print
Hello from user mode!
syscall: yield
sched: switching 0 -&gt; 1
syscall: print
Hello from user mode!
syscall: yield
sched: switching 1 -&gt; 0
syscall: exit: code=0
sched: switching 0 -&gt; 1
syscall: exit: code=0
sched: no tasks to run, halting
</span></code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It works! The scheduler first runs task 0, which prints a message, then yields control to the kernel. The scheduler then switches to task 1, which prints another message, and then yields control back to the kernel. The scheduler then switches back to task 0, which calls <code>exit</code>, which terminates the task. The scheduler then switches to task 1, which also calls <code>exit</code> and terminates the task. Since there are no more tasks in the queue, the scheduler halts the CPU.</p><p>Let&#39;s add a third task for fun and see what happens.</p><div class="language-sh-session line-numbers-mode" data-ext="sh-session"><pre class="language-sh-session"><code><span class="token output">kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -&gt; 0
syscall: print
Hello from user mode!
syscall: yield
sched: switching 0 -&gt; 1
syscall: print
Hello from user mode!
syscall: yield
sched: switching 1 -&gt; 2
syscall: print
Hello from user mode!
syscall: yield
sched: switching 2 -&gt; 0
syscall: exit: code=0
sched: switching 0 -&gt; 1
syscall: exit: code=0
sched: switching 1 -&gt; 2
syscall: exit: code=0
sched: no tasks to run, halting
</span></code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It works! The scheduler runs all three tasks in a round-robin fashion, and then halts the CPU when there are no more tasks to run. This is exciting! We now have a simple cooperative multitasking system.</p><p>Now that we have a few system calls, it&#39;s time to add a system library that can be used by user tasks to invoke these system calls, instead of using inline assembly. We&#39;ll do that in the next chapter.</p>`,43),o=[i];function l(c,r){return n(),e("div",null,o)}const d=s(t,[["render",l],["__file","23-coop-multitasking.html.vue"]]);export{d as default};
