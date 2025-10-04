import{_ as n,c as a,e,o as l}from"./app-BEnvQN0t.js";const i={};function t(p,s){return l(),a("div",null,[...s[0]||(s[0]=[e(`<h1 id="cooperative-multitasking" tabindex="-1"><a class="header-anchor" href="#cooperative-multitasking"><span>Cooperative Multitasking</span></a></h1><p>The idea of cooperative multitasking is that, at certain points in the task&#39;s execution, it voluntarily yields control back to the kernel. This is done by invoking a system call, typically called <code>yield</code>. In other cases, if the task invokes a system call that blocks, this is also considered a yield. The kernel then decides which task to run next, and returns control to that task.</p><p>The advantage of cooperative multitasking is that it is very simple to implement. The disadvantage is that if a task does not yield, it will never be preempted. This means that a single task can monopolize the CPU, and the system will become unresponsive. In <strong>preemptive multitasking</strong>, the kernel uses a timer to interrupt the currently running task, and preempt it if its time slice has expired, or if a higher priority task is ready to run. This ensures that no task can monopolize the CPU. We&#39;ll see how to implement preemptive multitasking later.</p><h2 id="scheduling" tabindex="-1"><a class="header-anchor" href="#scheduling"><span>Scheduling</span></a></h2><p>We&#39;ll add a new kernel component called the <strong>scheduler</strong>. The scheduler is responsible for keeping track of all the tasks in the system, and deciding which task to run next. It is invoked by the kernel at certain points, such as when a task yields or blocks. This means it needs to keep track of the currently running task, and the list of ready tasks. Upon invocation, it will decide which task to run next based on some strategy, and switch to that task. The simplest strategy is <strong>round-robin</strong> scheduling, where the scheduler simply runs each task in turn. There are many other strategies, but we&#39;ll start with round-robin.</p><p>To make it easy to manage the ready tasks, we&#39;ll use a <strong>task queue</strong>. The current task will be stored in a global variable, outside the queue. Here&#39;s how we&#39;re going to make scheduling decisions:</p><ul><li>When the scheduler is invoked (e.g. when a task yields), it will add the current task to the end of the queue, and then remove the first task from the queue, assign it to the current task, and switch to it.</li><li>If the queue is empty, the scheduler will simply return, and the current task will continue running.</li><li>When a task exits, we simply won&#39;t add it back to the queue, and the next task in the queue will be run.</li><li>If a task exits and there are no more tasks in the queue, we&#39;ll simply halt the CPU.</li></ul><p>Before we start implementing the scheduler, we need to make some changes to the <code>Task</code> type. We need to track the task <strong>state</strong>, which can be <code>New</code>, <code>Ready</code>, <code>Running</code>, or <code>Terminated</code> (for now). I&#39;m also going to change the layout of the <code>Task</code> type by making the <code>rsp</code> field the first field, so that we can easily access it from inline assembly later. Here&#39;s the updated <code>tasks.nim</code> module:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/tasks.nim</span></span>
<span class="line"><span class="token keyword">type</span></span>
<span class="line">  TaskState <span class="token operator">=</span> <span class="token keyword">enum</span></span>
<span class="line">    New<span class="token punctuation">,</span> Ready<span class="token punctuation">,</span> Running<span class="token punctuation">,</span> Terminated</span>
<span class="line"></span>
<span class="line">  Task<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">ref</span> <span class="token keyword">object</span></span>
<span class="line">    rsp<span class="token operator">*:</span> uint64</span>
<span class="line">    state<span class="token operator">*:</span> TaskState</span>
<span class="line">    <span class="token comment"># other fields...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s start by creating a new module called <code>sched.nim</code> in the <code>kernel</code> directory. We&#39;ll define a task queue, a global variable to store the current task, and a proc to add a task to the queue:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/sched.nim</span></span>
<span class="line"><span class="token keyword">import</span> std<span class="token operator">/</span>deques</span>
<span class="line"></span>
<span class="line"><span class="token keyword">import</span> tasks</span>
<span class="line"></span>
<span class="line"><span class="token keyword">var</span></span>
<span class="line">  readyTasks <span class="token operator">=</span> <span class="token function">initDeque[Task]</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">  currentTask<span class="token operator">*</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span><span class="token operator">:</span> Task</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">addTask<span class="token operator">*</span></span><span class="token punctuation">(</span>t<span class="token operator">:</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  readyTasks<span class="token operator">.</span><span class="token function">addLast</span><span class="token punctuation">(</span>t<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If you remember, we already had defined a <code>currentTask</code> in the <code>tasks.nim</code> module. We&#39;ll make some changes to that module later when we get to context switching. I&#39;m annotating <code>currentTask</code> with the <code>exportc</code> pragma since we&#39;ll need to access it from inline assembly later. Let&#39;s now add the main scheduler proc:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/sched.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">schedule<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">if</span> readyTasks<span class="token operator">.</span>len <span class="token operator">==</span> <span class="token number">0</span><span class="token operator">:</span></span>
<span class="line">    <span class="token keyword">if</span> currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> Terminated<span class="token operator">:</span></span>
<span class="line">      debugln <span class="token operator">&amp;</span><span class="token string">&quot;sched: no tasks to run, halting&quot;</span></span>
<span class="line">      <span class="token function">halt</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">      <span class="token comment"># no ready tasks, keep running the current task</span></span>
<span class="line">      <span class="token keyword">return</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> <span class="token function">not</span> <span class="token punctuation">(</span>currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> Terminated<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># put the current task back into the queue</span></span>
<span class="line">    currentTask<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Ready</span>
<span class="line">    readyTasks<span class="token operator">.</span><span class="token function">addLast</span><span class="token punctuation">(</span>currentTask<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># switch to the first task in the queue</span></span>
<span class="line">  <span class="token keyword">var</span> nextTask <span class="token operator">=</span> readyTasks<span class="token operator">.</span><span class="token function">popFirst</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">  </span>
<span class="line">  <span class="token function">switchTo</span><span class="token punctuation">(</span>nextTask<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The current implementation of <code>switchTo</code> (in <code>tasks.nim</code>) only knows how to switch to a new task. We&#39;ll need to change it to perform an actual context switch.</p><h2 id="context-switching" tabindex="-1"><a class="header-anchor" href="#context-switching"><span>Context Switching</span></a></h2><p>When switching between tasks, we need to save the state of the currently running task, and restore the state of the task that is about to run. The task state typically includes the CPU registers and the stack pointer. We don&#39;t need to save the instruction pointer, because once we swap the stack pointers, the old task resumes execution at the same point where its stack pointer was swapped out previously, and will continue as if nothing had happened. It&#39;s this swapping of stack pointers that causes the context switch.</p><p>Let&#39;s create a new module <code>ctxswitch.nim</code> to handle context switching. We&#39;ll move the <code>switchTo</code> proc from <code>tasks.nim</code> to <code>ctxswitch.nim</code>, and modify it to handle switching between tasks.</p><p>When the current task is not <code>nil</code> or terminated, we&#39;ll save its stack pointer and register state, regardless of whether we&#39;re switching to a new task or not. When we&#39;re switching to a new task, we&#39;ll simply load the new task&#39;s stack pointer and <code>iretq</code> to return to user mode. When we&#39;re switching to an existing task, we&#39;ll restore its stack pointer and register state and return normally.</p><p>Here&#39;s the modified <code>switchTo</code> proc:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/ctxswitch.nim</span></span>
<span class="line"><span class="token keyword">import</span> cpu</span>
<span class="line"><span class="token keyword">import</span> gdt</span>
<span class="line"><span class="token keyword">import</span> tasks</span>
<span class="line"><span class="token keyword">import</span> vmm</span>
<span class="line"></span>
<span class="line"><span class="token keyword">var</span></span>
<span class="line">  currentTask <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span><span class="token operator">:</span> Task</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">switchTo<span class="token operator">*</span></span><span class="token punctuation">(</span>next<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  tss<span class="token operator">.</span>rsp0 <span class="token operator">=</span> next<span class="token operator">.</span>kstack<span class="token operator">.</span>bottom</span>
<span class="line">  <span class="token function">setActivePML4</span><span class="token punctuation">(</span>next<span class="token operator">.</span>space<span class="token operator">.</span>pml4<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> <span class="token function">not</span> <span class="token punctuation">(</span>currentTask<span class="token operator">.</span>isNil <span class="token operator">or</span> currentTask<span class="token operator">.</span>state <span class="token operator">==</span> TaskState<span class="token operator">.</span>Terminated<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    <span class="token function">pushRegs</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">      mov %0, rsp</span>
<span class="line">      : &quot;=m&quot; (\`currentTask\`-&gt;rsp)</span>
<span class="line">    &quot;&quot;&quot;</span></span>
<span class="line"></span>
<span class="line">  currentTask <span class="token operator">=</span> next</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">case</span> next<span class="token operator">.</span>state</span>
<span class="line">  <span class="token operator">of</span> TaskState<span class="token operator">.</span>New<span class="token operator">:</span></span>
<span class="line">    next<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Running</span>
<span class="line">    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">      mov rsp, %0</span>
<span class="line">      iretq</span>
<span class="line">      :</span>
<span class="line">      : &quot;m&quot; (\`currentTask\`-&gt;rsp)</span>
<span class="line">    &quot;&quot;&quot;</span></span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    next<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Running</span>
<span class="line">    <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">      mov rsp, %0</span>
<span class="line">      :</span>
<span class="line">      : &quot;m&quot; (\`currentTask\`-&gt;rsp)</span>
<span class="line">    &quot;&quot;&quot;</span></span>
<span class="line">    <span class="token function">popRegs</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s define <code>pushRegs</code> and <code>popRegs</code>, but instead of defining them in this module, we&#39;ll put them in the <code>cpu.nim</code> module, where they belong. Here, I&#39;ll be using Nim templates instead of procs to avoid the overhead of calling a proc.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/cpu.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">template</span> <span class="token function">pushRegs<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    push rax</span>
<span class="line">    push rbx</span>
<span class="line">    push rcx</span>
<span class="line">    push rdx</span>
<span class="line">    push rsi</span>
<span class="line">    push rdi</span>
<span class="line">    push rbp</span>
<span class="line">    push r8</span>
<span class="line">    push r9</span>
<span class="line">    push r10</span>
<span class="line">    push r11</span>
<span class="line">    push r12</span>
<span class="line">    push r13</span>
<span class="line">    push r14</span>
<span class="line">    push r15</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">template</span> <span class="token function">popRegs<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    pop r15</span>
<span class="line">    pop r14</span>
<span class="line">    pop r13</span>
<span class="line">    pop r12</span>
<span class="line">    pop r11</span>
<span class="line">    pop r10</span>
<span class="line">    pop r9</span>
<span class="line">    pop r8</span>
<span class="line">    pop rbp</span>
<span class="line">    pop rdi</span>
<span class="line">    pop rsi</span>
<span class="line">    pop rdx</span>
<span class="line">    pop rcx</span>
<span class="line">    pop rbx</span>
<span class="line">    pop rax</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="yield-system-call" tabindex="-1"><a class="header-anchor" href="#yield-system-call"><span><code>yield</code> System Call</span></a></h2><p>To allow a task to yield control to the kernel, we&#39;ll add a new system call called <code>yield</code>. When a task invokes this system call, the kernel simply calls the scheduler to switch to the next task. Let&#39;s add it to the <code>syscall.nim</code> module:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/syscalls.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line highlighted"><span class="token keyword">proc</span> <span class="token function">\`yield\`<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line highlighted">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: yield&quot;</span></span>
<span class="line highlighted">  <span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token comment"># set up syscall table</span></span>
<span class="line">  syscallTable<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> exit</span>
<span class="line">  syscallTable<span class="token punctuation">[</span><span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">=</span> print</span>
<span class="line highlighted">  syscallTable<span class="token punctuation">[</span><span class="token number">3</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token identifier"><span class="token punctuation">\`</span>yield<span class="token punctuation">\`</span></span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that we have to quote the <code>yield</code> proc name because it&#39;s a reserved keyword in Nim. Now, tasks can invoke syscall 3 (with no arguments) to yield control to the kernel. Let&#39;s add this syscall to our user task:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/user/utask.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    # call print</span>
<span class="line">    ...</span>
<span class="line"></span>
<span class="line highlighted">    # call yield</span>
<span class="line highlighted">    mov rdi, 3</span>
<span class="line highlighted">    syscall</span>
<span class="line"></span>
<span class="line">    # call exit</span>
<span class="line">    ...</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The task now will print something, yield control to the kernel, and then exit.</p><h2 id="handling-task-exits" tabindex="-1"><a class="header-anchor" href="#handling-task-exits"><span>Handling Task Exits</span></a></h2><p>When the current task calls the <code>exit</code> system call, we should also invoke the scheduler, but the task shouldn&#39;t be put back into the queue. We can do this by setting the task&#39;s state to <code>Terminated</code> before invoking the scheduler. Terminating a task may involve other steps later (e.g. freeing its memory), so let&#39;s add a <code>terminateTask</code> proc to the <code>tasks.nim</code> module:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/tasks.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">terminateTask<span class="token operator">*</span></span><span class="token punctuation">(</span>t<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  t<span class="token operator">.</span>state <span class="token operator">=</span> TaskState<span class="token operator">.</span>Terminated</span>
<span class="line">  <span class="token comment"># other cleanup...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s modify the <code>exit</code> syscall to call <code>terminateTask</code> before invoking the scheduler:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/syscalls.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">exit<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: exit: code={args.arg1}&quot;</span></span>
<span class="line">  <span class="token function">terminateTask</span><span class="token punctuation">(</span>currentTask<span class="token punctuation">)</span></span>
<span class="line">  <span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="running-multiple-tasks" tabindex="-1"><a class="header-anchor" href="#running-multiple-tasks"><span>Running multiple tasks</span></a></h2><p>Let&#39;s now create two user tasks, add them to the task queue, and invoke the scheduler.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Creating user tasks&quot;</span></span>
<span class="line">  <span class="token keyword">var</span> task1 <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span></span>
<span class="line">    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span></span>
<span class="line">    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">var</span> task2 <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span></span>
<span class="line">    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span></span>
<span class="line">    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Adding tasks to scheduler&quot;</span></span>
<span class="line">  sched<span class="token operator">.</span><span class="token function">addTask</span><span class="token punctuation">(</span>task1<span class="token punctuation">)</span></span>
<span class="line">  sched<span class="token operator">.</span><span class="token function">addTask</span><span class="token punctuation">(</span>task2<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Starting scheduler&quot;</span></span>
<span class="line">  sched<span class="token operator">.</span><span class="token function">schedule</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s run it and see what happens.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token output">kernel: Creating user tasks</span>
<span class="line">kernel: Applying relocations to user image</span>
<span class="line">kernel: Applying relocations to user image</span>
<span class="line">kernel: Adding tasks to scheduler</span>
<span class="line">kernel: Starting scheduler</span>
<span class="line">sched: switching -&gt; 0</span>
<span class="line">syscall: print</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">syscall: print</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 1 -&gt; 0</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: no tasks to run, halting</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It works! The scheduler first runs task 0, which prints a message, then yields control to the kernel. The scheduler then switches to task 1, which prints another message, and then yields control back to the kernel. The scheduler then switches back to task 0, which calls <code>exit</code>, which terminates the task. The scheduler then switches to task 1, which also calls <code>exit</code> and terminates the task. Since there are no more tasks in the queue, the scheduler halts the CPU.</p><p>Let&#39;s add a third task for fun and see what happens.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token output">kernel: Adding tasks to scheduler</span>
<span class="line">kernel: Starting scheduler</span>
<span class="line">sched: switching -&gt; 0</span>
<span class="line">syscall: print</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">syscall: print</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 1 -&gt; 2</span>
<span class="line">syscall: print</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 2 -&gt; 0</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: switching 1 -&gt; 2</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: no tasks to run, halting</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It works! The scheduler runs all three tasks in a round-robin fashion, and then halts the CPU when there are no more tasks to run. This is exciting! We now have a simple cooperative multitasking system.</p><p>Now that we have a few system calls, it&#39;s time to add a system library that can be used by user tasks to invoke these system calls, instead of using inline assembly. We&#39;ll do that in the next chapter.</p>`,43)])])}const o=n(i,[["render",t],["__file","23-coop-multitasking.html.vue"]]),r=JSON.parse(`{"path":"/osdev/23-coop-multitasking.html","title":"Cooperative Multitasking","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Scheduling","slug":"scheduling","link":"#scheduling","children":[]},{"level":2,"title":"Context Switching","slug":"context-switching","link":"#context-switching","children":[]},{"level":2,"title":"yield System Call","slug":"yield-system-call","link":"#yield-system-call","children":[]},{"level":2,"title":"Handling Task Exits","slug":"handling-task-exits","link":"#handling-task-exits","children":[]},{"level":2,"title":"Running multiple tasks","slug":"running-multiple-tasks","link":"#running-multiple-tasks","children":[]}],"git":{"updatedTime":1744638230000},"filePathRelative":"osdev/23-coop-multitasking.md","excerpt":"\\n<p>The idea of cooperative multitasking is that, at certain points in the task's execution,\\nit voluntarily yields control back to the kernel. This is done by invoking a system call,\\ntypically called <code>yield</code>. In other cases, if the task invokes a system call that blocks,\\nthis is also considered a yield. The kernel then decides which task to run next, and\\nreturns control to that task.</p>"}`);export{o as comp,r as data};
