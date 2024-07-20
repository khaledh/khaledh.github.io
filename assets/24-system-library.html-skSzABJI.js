import{_ as s,o as n,c as e,f as a}from"./app-y8sbR1MG.js";const i={},t=a(`<h1 id="system-library" tabindex="-1"><a class="header-anchor" href="#system-library" aria-hidden="true">#</a> System Library</h1><p>So far, we have three system calls: <code>print</code>, <code>yield</code>, and <code>exit</code>. It&#39;s going to be tedious to write everything in assembly, so we need to write a system library that wraps these system calls in procs that we can call from our user tasks. This library will be the interface between our user tasks and the kernel.</p><h2 id="writing-the-library" tabindex="-1"><a class="header-anchor" href="#writing-the-library" aria-hidden="true">#</a> Writing the Library</h2><p>Let&#39;s create a new top-level directory called <code>syslib</code>, and inside it, we&#39;ll create two modules for our system calls: <code>io.nim</code> (for <code>print</code>), and <code>os.nim</code> (for <code>yield</code> and <code>exit</code>). Since system call numbers need to be unique, let&#39;s define them in a common module called <code>syscalldef.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/syslib/syscalldef.nim</span>

<span class="token keyword">const</span>
  SysExit <span class="token operator">=</span> <span class="token number">1</span>
  SysPrint <span class="token operator">=</span> <span class="token number">2</span>
  SysYield <span class="token operator">=</span> <span class="token number">3</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now let&#39;s add <code>io.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/syslib/io.nim</span>
<span class="token keyword">include</span> syscalldef

<span class="token keyword">proc</span> <span class="token function">print<span class="token operator">*</span></span><span class="token punctuation">(</span>pstr<span class="token operator">:</span> <span class="token keyword">ptr</span> string<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, %0
    mov rsi, %1
    syscall
    :
    : &quot;i&quot; (\`SysPrint\`), &quot;m&quot; (\`pstr\`)
    : &quot;rdi&quot;, &quot;rsi&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This is our first system call wrapper, <code>print</code>. It takes a pointer to a string and passes it to the kernel system call <code>SysPrint</code>.</p><p>Next, let&#39;s add <code>os.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/syslib/os.nim</span>
<span class="token keyword">include</span> syscalldef

<span class="token keyword">proc</span> <span class="token function">yld<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, %0
    syscall
    :
    : &quot;i&quot; (\`SysYield\`)
    : &quot;rdi&quot;
  &quot;&quot;&quot;</span>

<span class="token keyword">proc</span> <span class="token function">exit<span class="token operator">*</span></span><span class="token punctuation">(</span>code<span class="token operator">:</span> int<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, %0
    mov rsi, %1
    syscall
    :
    : &quot;i&quot; (\`SysExit\`), &quot;r&quot; (\`code\`)
    : &quot;rdi&quot;, &quot;rsi&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>These are the wrappers for <code>yield</code> and <code>exit</code>. <code>yield</code> doesn&#39;t take any arguments, so it just passes the system call number to the kernel. <code>exit</code> takes an integer argument, which is the exit code.</p><h2 id="using-the-library" tabindex="-1"><a class="header-anchor" href="#using-the-library" aria-hidden="true">#</a> Using the Library</h2><p>It&#39;s time to put our brand new system library to use. Let&#39;s modify our user task to use all three system calls, instead of the direct system calls we had before.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token keyword">import</span> common<span class="token operator">/</span><span class="token punctuation">[</span>libc<span class="token punctuation">,</span> malloc<span class="token punctuation">]</span>
<span class="token keyword">import</span> syslib<span class="token operator">/</span><span class="token punctuation">[</span>io<span class="token punctuation">,</span> os<span class="token punctuation">]</span>

<span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span>

<span class="token keyword">let</span>
  msg <span class="token operator">=</span> <span class="token string">&quot;Hello from user mode!&quot;</span>
  pmsg <span class="token operator">=</span> msg<span class="token operator">.</span><span class="token keyword">addr</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token function">print</span><span class="token punctuation">(</span>pmsg<span class="token punctuation">)</span>
  <span class="token function">yld</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  <span class="token function">exit</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This looks much cleaner and more readable than the assembly code we had before. We can now write our user tasks in Nim, and the system library will take care of the system calls for us.</p><p>Let&#39;s try it out.</p><div class="language-sh-session line-numbers-mode" data-ext="sh-session"><pre class="language-sh-session"><code><span class="token output">...
kernel: Adding tasks to scheduler
kernel: Starting scheduler
sched: switching -&gt; 0
Hello from user mode!
syscall: yield
sched: switching 0 -&gt; 1
Hello from user mode!
syscall: yield
sched: switching 1 -&gt; 2
Hello from user mode!
syscall: yield
sched: switching 2 -&gt; 0
syscall: exit: code=0
sched: switching 0 -&gt; 1
syscall: exit: code=0
sched: switching 1 -&gt; 2
syscall: exit: code=0
sched: no tasks to run, halting
</span></code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>No surprises, everything works as expected. We have successfully abstracted the system calls into a library, making it easier to write user tasks without worry about the details of system calls. We can now add more system calls to the library as we need them.</p>`,18),l=[t];function o(c,d){return n(),e("div",null,l)}const p=s(i,[["render",o],["__file","24-system-library.html.vue"]]);export{p as default};
