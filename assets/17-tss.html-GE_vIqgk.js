import{_ as n,o as s,c as a,e}from"./app-IpIrRMej.js";const t={},i=e(`<h1 id="task-state-segment" tabindex="-1"><a class="header-anchor" href="#task-state-segment" aria-hidden="true">#</a> Task State Segment</h1><p>While running in user mode, an interrupt/exception or a system call causes the CPU to switch to kernel mode. This causes a change in privilege level (from CPL=3 to CPL=0). The CPU cannot use the user stack while in kernel mode, since the interrupt could have been caused by something that makes the stack unusable, e.g. a page fault caused by running out of stack space. So, the CPU needs to switch to a known good stack. This is where the Task State Segment (TSS) comes in.</p><p>The TSS originally was designed to support hardware task switching. This is a feature that allows the CPU to switch between multiple tasks (each having its own TSS) without software intervention. This feature is not used in modern operating systems, which rely on software task switching, but the TSS is still used to switch stacks when entering kernel mode.</p><p>The TSS on x64 contains two sets of stack pointers:</p><ul><li>One set holds three stack pointers, <code>RSP0</code>, <code>RSP1</code>, and <code>RSP2</code>, to use when switching to CPL=0, CPL=1, and CPL=2, respectively. Typically, only <code>RSP0</code> is used when switching from user mode to kernel mode, since rings 1 and 2 are not used in modern operating systems.</li><li>The other set holds so-called Interrupt Stack Table, which can hold up to seven stack pointers, <code>IST1</code> through <code>IST7</code>, to use when handling interrupts. The decision to use one of those stacks is made by the Interrupt Descriptor Table entry for the interrupt. The stack pointer to use is stored in the <code>IST</code> field of the IDT entry. This means that different interrupts can use different stacks. If an IDT entry doesn&#39;t specify a stack, the CPU uses the stack pointed to by <code>RSP0</code>.</li></ul><p>Here&#39;s a diagram of the TSS structure:</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>                 64-bit TSS Structure
   31                                              00
  ┌────────────────────────┬────────────────────────┐
  │ I/O Map Base Address   │        Reserved        │ 100
  ├────────────────────────┴────────────────────────┤
  │                  Reserved                       │ 96
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 92
  ├─────────────────────────────────────────────────┤
  │                  IST7 (hi)                      │ 88
  ├─────────────────────────────────────────────────┤
  │                  IST7 (lo)                      │ 84
  ├─────────────────────────────────────────────────┤
  │                     ...                         │
  ├─────────────────────────────────────────────────┤
  │                  IST1 (hi)                      │ 40
  ├─────────────────────────────────────────────────┤
  │                  IST1 (lo)                      │ 36
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 32
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 28
  ├─────────────────────────────────────────────────┤
  │                  RSP2 (hi)                      │ 24
  ├─────────────────────────────────────────────────┤
  │                  RSP2 (lo)                      │ 20
  ├─────────────────────────────────────────────────┤
  │                  RSP1 (hi)                      │ 16
  ├─────────────────────────────────────────────────┤
  │                  RSP1 (lo)                      │ 12
  ├─────────────────────────────────────────────────┤
  │                  RSP0 (hi)                      │ 8
  ├─────────────────────────────────────────────────┤
  │                  RSP0 (lo)                      │ 4
  ├─────────────────────────────────────────────────┤
  │                  Reserved                       │ 0
  └─────────────────────────────────────────────────┘
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>So, how does the CPU find the TSS? There&#39;s a special register called <code>TR</code> (Task Register) that holds the segment selector of the TSS. The CPU uses this selector to find the TSS in the GDT. So, what we need to do is to create a TSS and load its selector into <code>TR</code>.</p><h2 id="creating-a-tss" tabindex="-1"><a class="header-anchor" href="#creating-a-tss" aria-hidden="true">#</a> Creating a TSS</h2><p>Let&#39;s define the TSS structure in <code>src/kernel/gdt.nim</code></p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/gdt.nim</span>

<span class="token keyword">type</span>
  TaskStateSegment <span class="token punctuation">{.</span>packed<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    reserved0<span class="token operator">:</span> uint32
    rsp0<span class="token operator">:</span> uint64
    rsp1<span class="token operator">:</span> uint64
    rsp2<span class="token operator">:</span> uint64
    reserved1<span class="token operator">:</span> uint64
    ist1<span class="token operator">:</span> uint64
    ist2<span class="token operator">:</span> uint64
    ist3<span class="token operator">:</span> uint64
    ist4<span class="token operator">:</span> uint64
    ist5<span class="token operator">:</span> uint64
    ist6<span class="token operator">:</span> uint64
    ist7<span class="token operator">:</span> uint64
    reserved2<span class="token operator">:</span> uint64
    reserved3<span class="token operator">:</span> uint16
    iomapBase<span class="token operator">:</span> uint16
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll need to define a new descriptor type for the TSS, so that we can add it to the GDT. This will be a system descriptor (as opposed to a code or data descriptor).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/gdt.nim</span>

<span class="token keyword">type</span>
  TaskStateSegmentDescriptor <span class="token punctuation">{.</span>packed<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    limit00<span class="token operator">:</span> uint16
    base00<span class="token operator">:</span> uint16
    base16<span class="token operator">:</span> uint8
    <span class="token identifier"><span class="token punctuation">\`</span>type<span class="token punctuation">\`</span></span><span class="token operator">*</span> <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">4.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0b1001</span>  <span class="token comment"># 64-bit TSS</span>
    s <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>  <span class="token comment"># System segment</span>
    dpl<span class="token operator">*</span> <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">2.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8
    p<span class="token operator">*</span> <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">1</span>
    limit16 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">4.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8
    avl<span class="token operator">*</span> <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    zero1 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    zero2 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    g <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    base24<span class="token operator">:</span> uint8
    base32<span class="token operator">:</span> uint32
    reserved1<span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    zero3 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">5.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    reserved2 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">19.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint32 <span class="token operator">=</span> <span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s create an instance of the TSS and a descriptor for it. Later, we&#39;ll create a kernel stack and set <code>RSP0</code> to point to it.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/gdt.nim</span>

<span class="token keyword">var</span>
  tss<span class="token operator">*</span> <span class="token operator">=</span> <span class="token function">TaskStateSegment</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

<span class="token keyword">let</span>
  tssDescriptor <span class="token operator">=</span> <span class="token function">TaskStateSegmentDescriptor</span><span class="token punctuation">(</span>
    dpl<span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span>
    base00<span class="token operator">:</span> <span class="token function">cast[uint16]</span><span class="token punctuation">(</span>tss<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    base16<span class="token operator">:</span> <span class="token function">cast[uint8]</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>tss<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span> <span class="token operator">shr</span> <span class="token number">16</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    base24<span class="token operator">:</span> <span class="token function">cast[uint8]</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>tss<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span> <span class="token operator">shr</span> <span class="token number">24</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    base32<span class="token operator">:</span> <span class="token function">cast[uint32]</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>tss<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span> <span class="token operator">shr</span> <span class="token number">32</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    limit00<span class="token operator">:</span> <span class="token function">cast[uint16]</span><span class="token punctuation">(</span><span class="token function">sizeof</span><span class="token punctuation">(</span>tss<span class="token punctuation">)</span> <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    limit16<span class="token operator">:</span> <span class="token function">cast[uint8]</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token function">sizeof</span><span class="token punctuation">(</span>tss<span class="token punctuation">)</span> <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token operator">shr</span> <span class="token number">16</span><span class="token punctuation">)</span>
  <span class="token punctuation">)</span>
  tssDescriptorLo <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>tssDescriptor<span class="token punctuation">)</span>
  tssDescriptorHi <span class="token operator">=</span> <span class="token punctuation">(</span><span class="token function">cast[ptr uint64]</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>tssDescriptor<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span> <span class="token operator">+</span> <span class="token number">8</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">[</span><span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Finally, let&#39;s add the descriptor to the GDT and define its selector. Notice that the GDT entry occupies two 64-bit slots (since the TSS descriptor is 128 bits long). The selector points to the first slot (the low 64 bits).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/gdt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">const</span>
  KernelCodeSegmentSelector<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x08</span>
  UserCodeSegmentSelector<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x10</span> <span class="token operator">or</span> <span class="token number">3</span> <span class="token comment"># RPL = 3</span>
  DataSegmentSelector<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x18</span> <span class="token operator">or</span> <span class="token number">3</span>     <span class="token comment"># RPL = 3</span>
  TaskStateSegmentSelector<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x20</span>

<span class="token keyword">let</span>
  <span class="token operator">...</span>

  gdtEntries <span class="token operator">=</span> <span class="token punctuation">[</span>
    NullSegmentDescriptor<span class="token operator">.</span>value<span class="token punctuation">,</span>
    <span class="token function">CodeSegmentDescriptor</span><span class="token punctuation">(</span>dpl<span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">)</span><span class="token operator">.</span>value<span class="token punctuation">,</span> <span class="token comment"># Kernel code segment</span>
    <span class="token function">CodeSegmentDescriptor</span><span class="token punctuation">(</span>dpl<span class="token operator">:</span> <span class="token number">3</span><span class="token punctuation">)</span><span class="token operator">.</span>value<span class="token punctuation">,</span> <span class="token comment"># User code segment</span>
    <span class="token function">DataSegmentDescriptor</span><span class="token punctuation">(</span>dpl<span class="token operator">:</span> <span class="token number">3</span><span class="token punctuation">)</span><span class="token operator">.</span>value<span class="token punctuation">,</span> <span class="token comment"># Data segment</span>
    tssDescriptorLo<span class="token punctuation">,</span>                     <span class="token comment"># Task state segment (low 64 bits)</span>
    tssDescriptorHi<span class="token punctuation">,</span>                     <span class="token comment"># Task state segment (high 64 bits)</span>
  <span class="token punctuation">]</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="loading-the-tss" tabindex="-1"><a class="header-anchor" href="#loading-the-tss" aria-hidden="true">#</a> Loading the TSS</h2><p>To tell the CPU to use the TSS, we need to load its selector into <code>TR</code> (Task Register). We&#39;ll do this as part of the <code>gdtInit</code> proc.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/gdt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">gdtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    lgdt %0

    mov ax, %3
    ltr ax

    # reload CS using a far return
    ...

    :
    : &quot;m&quot;(\`gdtDescriptor\`),
      &quot;i&quot;(\`KernelCodeSegmentSelector\`),
      &quot;i&quot;(\`DataSegmentSelector\`),
      &quot;i&quot;(\`TaskStateSegmentSelector\`)
    : &quot;rax&quot; 
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="kernel-switch-stack" tabindex="-1"><a class="header-anchor" href="#kernel-switch-stack" aria-hidden="true">#</a> Kernel Switch Stack</h2><p>We now need to define a new stack to use when switching to kernel mode. Let&#39;s allocate a page for it, map it, and set the <code>RSP0</code> field of the TSS to point to it.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># allocate and map user stack</span>
  <span class="token operator">...</span>

  <span class="token comment"># create a kernel switch stack and set tss.rsp0</span>
  debugln <span class="token string">&quot;kernel: Creating kernel switch stack&quot;</span>
  <span class="token keyword">let</span> switchStackPhysAddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token operator">.</span>get
  <span class="token keyword">let</span> switchStackVirtAddr <span class="token operator">=</span> <span class="token function">p2v</span><span class="token punctuation">(</span>switchStackPhysAddr<span class="token punctuation">)</span>
  <span class="token function">mapRegion</span><span class="token punctuation">(</span>
    pml4 <span class="token operator">=</span> kpml4<span class="token punctuation">,</span>
    virtAddr <span class="token operator">=</span> switchStackVirtAddr<span class="token punctuation">,</span>
    physAddr <span class="token operator">=</span> switchStackPhysAddr<span class="token punctuation">,</span>
    pageCount <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">,</span>
    pageAccess <span class="token operator">=</span> paReadWrite<span class="token punctuation">,</span>
    pageMode <span class="token operator">=</span> pmSupervisor<span class="token punctuation">,</span>
  <span class="token punctuation">)</span>
  tss<span class="token operator">.</span>rsp0 <span class="token operator">=</span> <span class="token function">uint64</span><span class="token punctuation">(</span>switchStackVirtAddr <span class="token operator">+!</span> PageSize<span class="token punctuation">)</span>

  <span class="token comment"># create interrupt stack frame</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Everything is now ready for the switch to kernel mode. There are a few ways to try this out.</p><h2 id="switching-to-kernel-mode" tabindex="-1"><a class="header-anchor" href="#switching-to-kernel-mode" aria-hidden="true">#</a> Switching to Kernel Mode</h2><p>One way to test this is to have the user task try to execute a privileged instruction, such as <code>hlt</code>. This should cause a General Protection Fault exception, which will trigger the switch to kernel mode. Let&#39;s try this out.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;hlt&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s run and see what happens.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel
...
kernel: Creating kernel switch stack
kernel: Creating interrupt stack frame
            SS: 0x1b
           RSP: 0x50001000
        RFLAGS: 0x202
            CS: 0x13
           RIP: 0x40000000
kernel: Switching to user mode

CPU Exception: General Protection Fault

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(65) cpuGeneralProtectionFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>As expected, the CPU switched to kernel mode and executed the General Protection Fault handler! Let&#39;s try another way. Let&#39;s cause a page fault by trying to access a page that&#39;s not mapped.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token comment"># access illegal memory</span>
  <span class="token keyword">var</span> x <span class="token operator">=</span> <span class="token function">cast[ptr int]</span><span class="token punctuation">(</span><span class="token number">0xdeadbeef</span><span class="token punctuation">)</span>
  x<span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token number">42</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We should see a page fault exception at the address <code>0xdeadbeef</code>.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>...
kernel: Switching to user mode

CPU Exception: Page Fault
    Faulting address: 0x00000000deadbeef

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(57) cpuPageFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! OK, one more way. Let&#39;s try to access an address within kernel space. This should also cause a Page Fault exception, even though the address is mapped.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token comment"># access kernel memory</span>
  <span class="token keyword">var</span> x <span class="token operator">=</span> <span class="token function">cast[ptr int]</span><span class="token punctuation">(</span><span class="token number">0xFFFF800000100000</span><span class="token punctuation">)</span>  <span class="token comment"># kernel entry point</span>
  x<span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token number">42</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s see what happens.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>...
kernel: Switching to user mode

CPU Exception: Page Fault
    Faulting address: 0xffff800000100000

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(57) cpuPageFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! This demonstrates that kernel memory is protected from access by user code.</p><h2 id="invoking-interrupts-from-user-mode" tabindex="-1"><a class="header-anchor" href="#invoking-interrupts-from-user-mode" aria-hidden="true">#</a> Invoking Interrupts from User Mode</h2><p>Finally, let&#39;s try to invoke an interrupt from user mode. Let&#39;s reuse the <code>isr100</code> interrupt handler we used for testing earlier.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">isr100</span><span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">,</span> codegenDecl<span class="token operator">:</span> <span class="token string">&quot;__attribute__ ((interrupt)) $# $#$#&quot;</span><span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;Hello from isr100&quot;</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">100</span><span class="token punctuation">,</span> isr100<span class="token punctuation">)</span>
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s execute the <code>int</code> instruction from user mode.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;int 100&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we try to run this, we are faced with a General Protection Fault exception.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>...
kernel: Switching to user mode

CPU Exception: General Protection Fault

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(53) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(185) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(66) cpuGeneralProtectionFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The reason has to do with the <code>DPL</code> of the interrupt gate. Recall that the <code>DPL</code> of the interrupt gate must be greater than or equal to the <code>CPL</code> of the code that invokes the interrupt. In this case, the <code>DPL</code> of the interrupt gate is 0, while the <code>CPL</code> of the user code is 3. So, the CPU raises a General Protection Fault exception.</p><p>Let&#39;s fix this by allowing the <code>isr100</code> handler to be called from user mode. We need to do a couple of modifications in the <code>idt.nim</code> module to allow setting the <code>dpl</code> field of the interrupt gate.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">newInterruptGate</span><span class="token punctuation">(</span>handler<span class="token operator">:</span> InterruptHandler<span class="token punctuation">,</span> dpl<span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">)</span><span class="token operator">:</span> InterruptGate <span class="token operator">=</span>
  <span class="token keyword">let</span> offset <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>handler<span class="token punctuation">)</span>
  result <span class="token operator">=</span> <span class="token function">InterruptGate</span><span class="token punctuation">(</span>
    offset00<span class="token operator">:</span> <span class="token function">uint16</span><span class="token punctuation">(</span>offset<span class="token punctuation">)</span><span class="token punctuation">,</span>
    offset16<span class="token operator">:</span> <span class="token function">uint16</span><span class="token punctuation">(</span>offset <span class="token operator">shr</span> <span class="token number">16</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    offset32<span class="token operator">:</span> <span class="token function">uint32</span><span class="token punctuation">(</span>offset <span class="token operator">shr</span> <span class="token number">32</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    dpl<span class="token operator">:</span> dpl<span class="token punctuation">,</span>
  <span class="token punctuation">)</span>

<span class="token keyword">proc</span> <span class="token function">installHandler<span class="token operator">*</span></span><span class="token punctuation">(</span>vector<span class="token operator">:</span> uint8<span class="token punctuation">,</span> handler<span class="token operator">:</span> InterruptHandler<span class="token punctuation">,</span> dpl<span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  idtEntries<span class="token punctuation">[</span>vector<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">newInterruptGate</span><span class="token punctuation">(</span>handler<span class="token punctuation">,</span> dpl<span class="token punctuation">)</span>

<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">100</span><span class="token punctuation">,</span> isr100<span class="token punctuation">,</span> dpl <span class="token operator">=</span> <span class="token number">3</span><span class="token punctuation">)</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><br><br><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try again.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Switching to user mode
Hello from isr100
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! We can call interrupts from user mode. We&#39;re now ready to start looking into system calls.</p>`,51),o=[i];function p(l,c){return s(),a("div",null,o)}const d=n(t,[["render",p],["__file","17-tss.html.vue"]]);export{d as default};
