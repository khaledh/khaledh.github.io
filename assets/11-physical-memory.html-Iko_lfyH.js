import{_ as n,c as a,e,o as p}from"./app-BEnvQN0t.js";const l={};function i(t,s){return p(),a("div",null,[...s[0]||(s[0]=[e(`<h1 id="physical-memory" tabindex="-1"><a class="header-anchor" href="#physical-memory"><span>Physical Memory</span></a></h1><p>Managing physical memory involves being able to allocate and free physical page frames. We&#39;ll create a <strong>Physical Memory Manager</strong> (PMM) that will keep track of which physical pages are free and which are in use. There are many ways to implement a PMM, the most popular being a bitmap, a free list, and a free stack. I&#39;ll keep it simple and implement a free list.</p><h2 id="free-list" tabindex="-1"><a class="header-anchor" href="#free-list"><span>Free List</span></a></h2><p>The free list will be a linked list of free memory regions. We will store the address of the list head in a global variable. Each node will be stored at the beginning of a free region, and will contain the region size in terms of frames, and a <code>next</code> pointer to the next node in the list. This way we don&#39;t have to allocate memory for the list itself ( except for the list head pointer), since we will use the free regions themselves to store the list nodes. Here&#39;s what it might look like after a few allocations and frees:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">     0                                         Physical Memory                                       max</span>
<span class="line">     ┌──┬────────────┬────────────┬──┬──────┬──────────────────────────────┬──┬─────────┬──────────────┐</span>
<span class="line">size │4 │            │░░░░░░░░░░░░│2 │      │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│3 │         │░░░░░░░░░░░░░░│</span>
<span class="line">     │  │    Free    │░░░░░░░░░░░░│  │ Free │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │   Free  │░░░░░░░░░░░░░░│</span>
<span class="line">next ├──┤            │░░░░░░░░░░░░├──┤      │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░├──┤         │░░░░░░░░░░░░░░│</span>
<span class="line">     └▲┬┴────────────┴────────────┴▲┬┴──────┴──────────────────────────────┴▲┬┴─────────┴──────────────┘</span>
<span class="line">      │└───────────────────────────┘└───────────────────────────────────────┘│</span>
<span class="line">head ─┘                                                                      └─▶ nil</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Allocating a page frame will involve finding a free region that is large enough, splitting it if necessary, and returning the starting address of the allocated region. Freeing a region will involve finding the correct place in the list to insert the region, and merging it with adjacent regions if necessary.</p><p>Let&#39;s start by creating a new module <code>src/kernel/pmm.nim</code> and defining the following types:</p><ul><li><code>PhysAddr</code> to represent a physical address</li><li><code>PMNode</code> to represent a node in the free list</li><li><code>PMRegion</code> to represent a region of memory</li></ul><p>and the following variables:</p><ul><li><code>head</code> to store the address of the list head</li><li><code>maxPhysAddr</code> to store the maximum physical address (exclusive)</li><li><code>reservedRegions</code> to store a list of reserved regions</li></ul><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">const</span></span>
<span class="line">  FrameSize <span class="token operator">=</span> <span class="token number">4096</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">type</span></span>
<span class="line">  PhysAddr <span class="token operator">=</span> <span class="token keyword">distinct</span> uint64</span>
<span class="line"></span>
<span class="line">  PMNode <span class="token operator">=</span> <span class="token keyword">object</span></span>
<span class="line">    nframes<span class="token operator">:</span> uint64</span>
<span class="line">    next<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line"></span>
<span class="line">  PMRegion<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span></span>
<span class="line">    start<span class="token operator">*:</span> PhysAddr</span>
<span class="line">    nframes<span class="token operator">*:</span> uint64</span>
<span class="line"></span>
<span class="line"><span class="token keyword">var</span></span>
<span class="line">  head<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line">  maxPhysAddr<span class="token operator">:</span> PhysAddr <span class="token comment"># exclusive</span></span>
<span class="line">  reservedRegions<span class="token operator">:</span> seq<span class="token punctuation">[</span>PMRegion<span class="token punctuation">]</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll also define several utility procs:</p><ul><li><code>toPMNodePtr</code> to convert from <code>ptr PMNode</code> to <code>PhysAddr</code></li><li><code>toPhysAddr</code> to convert from <code>PhysAddr</code> to <code>ptr PMNode</code></li><li><code>==</code>, <code>&lt;</code>, and <code>-</code> operators for <code>PhysAddr</code></li><li><code>endAddr</code> to calculate the end address of a region given its start address and size</li><li><code>adjacent</code> to check if a node is adjacent to a physical address (and vice versa)</li><li><code>overlaps</code> to check if two regions overlap</li></ul><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">toPMNodePtr<span class="token operator">*</span></span><span class="token punctuation">(</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token function">cast[ptr PMNode]</span><span class="token punctuation">(</span>paddr<span class="token punctuation">)</span></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">toPhysAddr<span class="token operator">*</span></span><span class="token punctuation">(</span>node<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode<span class="token punctuation">)</span><span class="token operator">:</span> PhysAddr <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token function">cast[PhysAddr]</span><span class="token punctuation">(</span>node<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">\`==\`<span class="token operator">*</span></span><span class="token punctuation">(</span>a<span class="token punctuation">,</span> b<span class="token operator">:</span> PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span> bool <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span> a<span class="token operator">.</span>uint64 <span class="token operator">==</span> b<span class="token operator">.</span>uint64</span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">\`&lt;\`</span><span class="token punctuation">(</span>p1<span class="token punctuation">,</span> p2<span class="token operator">:</span> PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span> bool <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span> p1<span class="token operator">.</span>uint64 <span class="token operator">&lt;</span> p2<span class="token operator">.</span>uint64</span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">\`-\`</span><span class="token punctuation">(</span>p1<span class="token punctuation">,</span> p2<span class="token operator">:</span> PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span> p1<span class="token operator">.</span>uint64 <span class="token operator">-</span> p2<span class="token operator">.</span>uint64</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> uint64<span class="token punctuation">)</span><span class="token operator">:</span> PhysAddr <span class="token operator">=</span></span>
<span class="line">  result <span class="token operator">=</span> paddr <span class="token operator">+!</span> nframes <span class="token operator">*</span> FrameSize</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>node<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode<span class="token punctuation">,</span> paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span> bool <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  result <span class="token operator">=</span> <span class="token punctuation">(</span></span>
<span class="line">    <span class="token operator">not</span> node<span class="token operator">.</span>isNil <span class="token operator">and</span></span>
<span class="line">    node<span class="token operator">.</span>toPhysAddr <span class="token operator">+!</span> node<span class="token operator">.</span>nframes <span class="token operator">*</span> FrameSize <span class="token operator">==</span> paddr</span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> uint64<span class="token punctuation">,</span> node<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode<span class="token punctuation">)</span><span class="token operator">:</span> bool <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  result <span class="token operator">=</span> <span class="token punctuation">(</span></span>
<span class="line">    <span class="token operator">not</span> node<span class="token operator">.</span>isNil <span class="token operator">and</span></span>
<span class="line">    paddr <span class="token operator">+!</span> nframes <span class="token operator">*</span> FrameSize <span class="token operator">==</span> node<span class="token operator">.</span>toPhysAddr</span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">overlaps</span><span class="token punctuation">(</span>region1<span class="token punctuation">,</span> region2<span class="token operator">:</span> PMRegion<span class="token punctuation">)</span><span class="token operator">:</span> bool <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">var</span> r1 <span class="token operator">=</span> region1</span>
<span class="line">  <span class="token keyword">var</span> r2 <span class="token operator">=</span> region2</span>
<span class="line">  <span class="token keyword">if</span> r1<span class="token operator">.</span>start <span class="token operator">&gt;</span> r2<span class="token operator">.</span>start<span class="token operator">:</span></span>
<span class="line">    r1 <span class="token operator">=</span> region2</span>
<span class="line">    r2 <span class="token operator">=</span> region1</span>
<span class="line">  result <span class="token operator">=</span> <span class="token punctuation">(</span></span>
<span class="line">    r1<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr <span class="token operator">&lt;</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>r2<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> r2<span class="token operator">.</span>nframes<span class="token punctuation">)</span> <span class="token operator">and</span></span>
<span class="line">    r2<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr <span class="token operator">&lt;</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>r1<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> r1<span class="token operator">.</span>nframes<span class="token punctuation">)</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Also, since we&#39;re going to do a lot of pointer arithmetic, let&#39;s define a <code>+!</code> operator for both <code>PhysAddr</code> and <code>ptr PMNode</code> that will allow us to add an offset to a physical address or a node pointer.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">\`+!\`<span class="token operator">*</span></span><span class="token punctuation">(</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span> offset<span class="token operator">:</span> uint64<span class="token punctuation">)</span><span class="token operator">:</span> PhysAddr <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">PhysAddr</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>paddr<span class="token punctuation">)</span> <span class="token operator">+</span> offset<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">\`+!\`<span class="token operator">*</span></span><span class="token punctuation">(</span>node<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode<span class="token punctuation">,</span> offset<span class="token operator">:</span> uint64<span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode <span class="token punctuation">{.</span>inline<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">cast[ptr PMNode]</span><span class="token punctuation">(</span><span class="token function">cast[uint64]</span><span class="token punctuation">(</span>node<span class="token punctuation">)</span> <span class="token operator">+</span> offset<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="initialization" tabindex="-1"><a class="header-anchor" href="#initialization"><span>Initialization</span></a></h2><p>The kernel already has the memory map passed to it by the bootloader, so we&#39;ll use that to initialize the PMM.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token keyword">import</span> common<span class="token operator">/</span>bootinfo</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">pmInit<span class="token operator">*</span></span><span class="token punctuation">(</span>memoryMap<span class="token operator">:</span> MemoryMap<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">var</span> prev<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">0</span> <span class="token operator">..&lt;</span> memoryMap<span class="token operator">.</span>len<span class="token operator">:</span></span>
<span class="line">    <span class="token keyword">let</span> entry <span class="token operator">=</span> memoryMap<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span></span>
<span class="line">    <span class="token keyword">if</span> entry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> MemoryType<span class="token operator">.</span>Free<span class="token operator">:</span></span>
<span class="line">      maxPhysAddr <span class="token operator">=</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>entry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> entry<span class="token operator">.</span>nframes<span class="token punctuation">)</span></span>
<span class="line">      <span class="token keyword">if</span> <span class="token operator">not</span> prev<span class="token operator">.</span>isNil <span class="token operator">and</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>prev<span class="token punctuation">,</span> entry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">        <span class="token comment"># merge contiguous regions</span></span>
<span class="line">        prev<span class="token operator">.</span>nframes <span class="token operator">+=</span> entry<span class="token operator">.</span>nframes</span>
<span class="line">      <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">        <span class="token comment"># create a new node</span></span>
<span class="line">        <span class="token keyword">var</span> node<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode <span class="token operator">=</span> entry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token operator">.</span>toPMNodePtr</span>
<span class="line">        node<span class="token operator">.</span>nframes <span class="token operator">=</span> entry<span class="token operator">.</span>nframes</span>
<span class="line">        node<span class="token operator">.</span>next <span class="token operator">=</span> <span class="token keyword">nil</span></span>
<span class="line"></span>
<span class="line">        <span class="token keyword">if</span> <span class="token operator">not</span> prev<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">          prev<span class="token operator">.</span>next <span class="token operator">=</span> node</span>
<span class="line">        <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">          head <span class="token operator">=</span> node</span>
<span class="line"></span>
<span class="line">        prev <span class="token operator">=</span> node</span>
<span class="line"></span>
<span class="line">    <span class="token keyword">elif</span> entry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> MemoryType<span class="token operator">.</span>Reserved<span class="token operator">:</span></span>
<span class="line">      reservedRegions<span class="token operator">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token function">PMRegion</span><span class="token punctuation">(</span>start<span class="token operator">:</span> entry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> entry<span class="token operator">.</span>nframes<span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">elif</span> i <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token operator">:</span></span>
<span class="line">      <span class="token comment"># check if there&#39;s a gap between the previous entry and the current entry</span></span>
<span class="line">      <span class="token keyword">let</span> prevEntry <span class="token operator">=</span> memoryMap<span class="token operator">.</span>entries<span class="token punctuation">[</span>i <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">]</span></span>
<span class="line">      <span class="token keyword">let</span> gap <span class="token operator">=</span> entry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr <span class="token operator">-</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>prevEntry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> prevEntry<span class="token operator">.</span>nframes<span class="token punctuation">)</span></span>
<span class="line">      <span class="token keyword">if</span> gap <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token operator">:</span></span>
<span class="line">        reservedRegions<span class="token operator">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token function">PMRegion</span><span class="token punctuation">(</span></span>
<span class="line">          start<span class="token operator">:</span> <span class="token function">endAddr</span><span class="token punctuation">(</span>prevEntry<span class="token operator">.</span>start<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> prevEntry<span class="token operator">.</span>nframes<span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line">          nframes<span class="token operator">:</span> gap <span class="token operator">div</span> FrameSize</span>
<span class="line">        <span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The initialization procedure iterates over the memory map entries, and for each free region it either merges it with the previous region if they are contiguous, or creates a new node and adds it to the list. We also track a couple of things that will be useful for validating requests to free regions:</p><ul><li>Reserved regions, either from the memory map or from gaps between memory map entries.</li><li>The maximum physical address, which is the end address of the last free region.</li></ul><p>To try it out and see if it works, we&#39;ll need a way to iterate over the list to print the nodes. Let&#39;s add an iterator for that.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">iterator</span> <span class="token function">pmFreeRegions<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">tuple</span><span class="token punctuation">[</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> uint64<span class="token punctuation">]</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">var</span> node <span class="token operator">=</span> head</span>
<span class="line">  <span class="token keyword">while</span> <span class="token operator">not</span> node<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">    <span class="token function">yield</span> <span class="token punctuation">(</span>node<span class="token operator">.</span>toPhysAddr<span class="token punctuation">,</span> node<span class="token operator">.</span>nframes<span class="token punctuation">)</span></span>
<span class="line">    node <span class="token operator">=</span> node<span class="token operator">.</span>next</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s now initialize the PMM and print the free regions.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">import</span> pmm</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Physical memory free regions &quot;</span></span>
<span class="line">  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Start&quot;:&gt;16}&quot;&quot;&quot;</span></span>
<span class="line">  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Start (KB)&quot;:&gt;12}&quot;&quot;&quot;</span></span>
<span class="line">  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Size (KB)&quot;:&gt;11}&quot;&quot;&quot;</span></span>
<span class="line">  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;#Pages&quot;:&gt;9}&quot;&quot;&quot;</span></span>
<span class="line">  debugln <span class="token string">&quot;&quot;</span></span>
<span class="line">  <span class="token keyword">var</span> totalFreePages<span class="token operator">:</span> uint64 <span class="token operator">=</span> <span class="token number">0</span></span>
<span class="line">  <span class="token function">for</span> <span class="token punctuation">(</span>start<span class="token punctuation">,</span> nframes<span class="token punctuation">)</span> <span class="token operator">in</span> <span class="token function">pmFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {cast[uint64](start):&gt;#16x}&quot;</span></span>
<span class="line">    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {cast[uint64](start) div 1024:&gt;#12}&quot;</span></span>
<span class="line">    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {nframes * 4:&gt;#11}&quot;</span></span>
<span class="line">    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {nframes:&gt;#9}&quot;</span></span>
<span class="line">    debugln <span class="token string">&quot;&quot;</span></span>
<span class="line">    totalFreePages <span class="token operator">+=</span> nframes</span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Total free: {totalFreePages * 4} KiB ({totalFreePages * 4 div 1024} MiB)&quot;</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  debugln <span class="token string">&quot;&quot;</span></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span></span>
<span class="line"></span>
<span class="line">  debug <span class="token string">&quot;kernel: Initializing physical memory manager &quot;</span></span>
<span class="line">  <span class="token function">pmInit</span><span class="token punctuation">(</span>bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token punctuation">)</span></span>
<span class="line">  debugln <span class="token string">&quot;[success]&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we run the kernel now, we should see something like this:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x21a000           2152          6040        1510</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124328 KiB (121 MiB)</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The list is much shorter than the original memory map, since we merged contiguous regions. Our PMM is now initialized and ready to be used.</p><h2 id="allocating-frames" tabindex="-1"><a class="header-anchor" href="#allocating-frames"><span>Allocating Frames</span></a></h2><p>A memory manager is not very useful if we can&#39;t allocate and free memory. Let&#39;s start with adding a <code>pmAlloc</code> to allocate a contiguous region of physical memory.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">import</span> std<span class="token operator">/</span>options</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">pmAlloc<span class="token operator">*</span></span><span class="token punctuation">(</span>nframes<span class="token operator">:</span> uint64<span class="token punctuation">)</span><span class="token operator">:</span> Option<span class="token punctuation">[</span>PhysAddr<span class="token punctuation">]</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token comment">## Allocate a contiguous region of physical memory.</span></span>
<span class="line">  assert nframes <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token punctuation">,</span> <span class="token string">&quot;Number of frames must be positive&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">var</span></span>
<span class="line">    prev<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line">    curr <span class="token operator">=</span> head</span>
<span class="line"></span>
<span class="line">  <span class="token comment"># find a region with enough frames</span></span>
<span class="line">  <span class="token keyword">while</span> <span class="token operator">not</span> curr<span class="token operator">.</span>isNil <span class="token operator">and</span> curr<span class="token operator">.</span>nframes <span class="token operator">&lt;</span> nframes<span class="token operator">:</span></span>
<span class="line">    prev <span class="token operator">=</span> curr</span>
<span class="line">    curr <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line">  </span>
<span class="line">  <span class="token keyword">if</span> curr<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># no region found</span></span>
<span class="line">    <span class="token keyword">return</span> <span class="token function">none</span><span class="token punctuation">(</span>PhysAddr<span class="token punctuation">)</span></span>
<span class="line">  </span>
<span class="line">  <span class="token keyword">var</span> newnode<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line">  <span class="token keyword">if</span> curr<span class="token operator">.</span>nframes <span class="token operator">==</span> nframes<span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># exact match</span></span>
<span class="line">    newnode <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># split the region</span></span>
<span class="line">    newnode <span class="token operator">=</span> <span class="token function">toPMNodePtr</span><span class="token punctuation">(</span>curr<span class="token operator">.</span>toPhysAddr <span class="token operator">+!</span> nframes <span class="token operator">*</span> FrameSize<span class="token punctuation">)</span></span>
<span class="line">    newnode<span class="token operator">.</span>nframes <span class="token operator">=</span> curr<span class="token operator">.</span>nframes <span class="token operator">-</span> nframes</span>
<span class="line">    newnode<span class="token operator">.</span>next <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> <span class="token operator">not</span> prev<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">    prev<span class="token operator">.</span>next <span class="token operator">=</span> newnode</span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    head <span class="token operator">=</span> newnode</span>
<span class="line"></span>
<span class="line">  result <span class="token operator">=</span> <span class="token function">some</span><span class="token punctuation">(</span>curr<span class="token operator">.</span>toPhysAddr<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The procedure iterates over the list until it finds a region with enough frames, and then either splits the region if it&#39;s larger than necessary, or removes it from the list if it&#39;s an exact match. If there&#39;s no region large enough, it returns <code>none</code>. Let&#39;s try it out by allocating a few pages and printing the free regions.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Allocating 4 pages&quot;</span></span>
<span class="line">  <span class="token keyword">let</span> paddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">4</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">if</span> paddr<span class="token operator">.</span>isSome<span class="token operator">:</span></span>
<span class="line">    debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Allocated at {paddr.get.uint64:#010x}&quot;</span></span>
<span class="line">    <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;kernel: Allocation failed&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s run the kernel and see what happens.</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124324 KiB (121 MiB)</span>
<span class="line">kernel: Allocating 4 pages</span>
<span class="line">kernel: Allocated at 0x00000000</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">             0x4000             16           624         156</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124308 KiB (121 MiB)</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It looks like it worked. We can see that the first 4 pages are now allocated, and the free regions list is updated accordingly. Let&#39;s see what happens if we try to allocate more pages than available in the first free region.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line">  <span class="token keyword">let</span> paddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">200</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124324 KiB (121 MiB)</span>
<span class="line">kernel: Allocating 200 pages</span>
<span class="line">kernel: Allocated at 0x0021b000</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x2e3000           2956          5236        1309</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 123524 KiB (120 MiB)</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The first region is skipped because it&#39;s not large enough, and the second region is used to allocate the pages, and its start address is updated and its size is reduced. Let&#39;s see what happens if we allocate exactly the number of pages in the first region (160 pages).</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line">  <span class="token keyword">let</span> paddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">160</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124324 KiB (121 MiB)</span>
<span class="line">kernel: Allocating 160 pages</span>
<span class="line">kernel: Allocated at 0x00000000</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 123684 KiB (120 MiB)</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The first region is now completely used, so it&#39;s removed from the list. Finally, let&#39;s see what happens if we try to allocate more pages than available in any free region.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line">  <span class="token keyword">let</span> paddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">25000</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions </span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x21b000           2156          6036        1509</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124324 KiB (121 MiB)</span>
<span class="line">kernel: Allocating 25000 pages</span>
<span class="line">kernel: Allocation failed</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The allocation fails because there are no regions large enough to satisfy the request.</p><h2 id="freeing-frames" tabindex="-1"><a class="header-anchor" href="#freeing-frames"><span>Freeing Frames</span></a></h2><p>Freeing a region is a lot more challenging than allocating one, because we need to:</p><ul><li>validate the request to make sure the region is: <ul><li>aligned to a page frame</li><li>within the physical memory range</li><li>not overlapping with any reserved regions</li><li>not overlapping with other free regions</li></ul></li><li>find the correct place in the free list to insert the region</li><li>if it&#39;s adjacent to other free regions, merge it with them</li><li>handle edge cases when the region is before or after all other regions</li></ul><p>Who said that writing an OS is easy? Let&#39;s go ahead and implement <code>pmFree</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/pmm.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">pmFree<span class="token operator">*</span></span><span class="token punctuation">(</span>paddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token comment">## Free a contiguous region of physical memory.</span></span>
<span class="line">  assert paddr<span class="token operator">.</span>uint64 <span class="token operator">mod</span> FrameSize <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">,</span> <span class="token operator">&amp;</span><span class="token string">&quot;Unaligned physical address: {paddr.uint64:#x}&quot;</span></span>
<span class="line">  assert nframes <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token punctuation">,</span> <span class="token string">&quot;Number of frames must be positive&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> paddr <span class="token operator">+!</span> nframes <span class="token operator">*</span> FrameSize <span class="token operator">&gt;</span> maxPhysAddr<span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># the region is outside of the physical memory</span></span>
<span class="line">    <span class="token keyword">raise</span> <span class="token function">newException</span><span class="token punctuation">(</span></span>
<span class="line">      Exception<span class="token punctuation">,</span></span>
<span class="line">      <span class="token operator">&amp;</span><span class="token string">&quot;Attempt to free a region outside of the physical memory.\\n&quot;</span> <span class="token operator">&amp;</span></span>
<span class="line">      <span class="token operator">&amp;</span><span class="token string">&quot;  Request: start={paddr.uint64:#x} + nframes={nframes} &gt; max={maxPhysAddr.uint64:#x}&quot;</span></span>
<span class="line">    <span class="token punctuation">)</span></span>
<span class="line">  </span>
<span class="line">  <span class="token keyword">for</span> region <span class="token operator">in</span> reservedRegions<span class="token operator">:</span></span>
<span class="line">    <span class="token keyword">if</span> <span class="token function">overlaps</span><span class="token punctuation">(</span>region<span class="token punctuation">,</span> <span class="token function">PMRegion</span><span class="token punctuation">(</span>start<span class="token operator">:</span> paddr<span class="token punctuation">,</span> nframes<span class="token operator">:</span> nframes<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">      <span class="token comment"># the region is reserved</span></span>
<span class="line">      <span class="token keyword">raise</span> <span class="token function">newException</span><span class="token punctuation">(</span></span>
<span class="line">        Exception<span class="token punctuation">,</span></span>
<span class="line">        <span class="token operator">&amp;</span><span class="token string">&quot;Attempt to free a reserved region.\\n&quot;</span> <span class="token operator">&amp;</span></span>
<span class="line">        <span class="token operator">&amp;</span><span class="token string">&quot;  Request: start={paddr.uint64:#x}, nframes={nframes}\\n&quot;</span> <span class="token operator">&amp;</span></span>
<span class="line">        <span class="token operator">&amp;</span><span class="token string">&quot;  Reserved: start={region.start.uint64:#x}, nframes={region.nframes}&quot;</span></span>
<span class="line">      <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">var</span></span>
<span class="line">    prev<span class="token operator">:</span> <span class="token keyword">ptr</span> PMNode</span>
<span class="line">    curr <span class="token operator">=</span> head</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">while</span> <span class="token operator">not</span> curr<span class="token operator">.</span>isNil <span class="token operator">and</span> curr<span class="token operator">.</span>toPhysAddr <span class="token operator">&lt;</span> paddr<span class="token operator">:</span></span>
<span class="line">    prev <span class="token operator">=</span> curr</span>
<span class="line">    curr <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">let</span></span>
<span class="line">    overlapsWithCurr <span class="token operator">=</span> <span class="token operator">not</span> curr<span class="token operator">.</span>isNil <span class="token operator">and</span> paddr <span class="token operator">+!</span> nframes <span class="token operator">*</span> FrameSize <span class="token operator">&gt;</span> curr<span class="token operator">.</span>toPhysAddr</span>
<span class="line">    overlapsWithPrev <span class="token operator">=</span> <span class="token operator">not</span> prev<span class="token operator">.</span>isNil <span class="token operator">and</span> paddr <span class="token operator">&lt;</span> prev<span class="token operator">.</span>toPhysAddr <span class="token operator">+!</span> prev<span class="token operator">.</span>nframes <span class="token operator">*</span> FrameSize</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> overlapsWithCurr <span class="token operator">or</span> overlapsWithPrev<span class="token operator">:</span></span>
<span class="line">    <span class="token keyword">raise</span> <span class="token function">newException</span><span class="token punctuation">(</span></span>
<span class="line">      Exception<span class="token punctuation">,</span></span>
<span class="line">      <span class="token operator">&amp;</span><span class="token string">&quot;Attempt to free a region that overlaps with another free region.\\n&quot;</span> <span class="token operator">&amp;</span></span>
<span class="line">      <span class="token operator">&amp;</span><span class="token string">&quot;  Request: start={paddr.uint64:#x}, nframes={nframes}&quot;</span></span>
<span class="line">    <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># the region to be freed is between prev and curr (either of them can be nil)</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">if</span> prev<span class="token operator">.</span>isNil <span class="token operator">and</span> curr<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;pmFree: the list is empty&quot;</span></span>
<span class="line">    <span class="token comment"># the list is empty</span></span>
<span class="line">    <span class="token keyword">var</span> newnode <span class="token operator">=</span> paddr<span class="token operator">.</span>toPMNodePtr</span>
<span class="line">    newnode<span class="token operator">.</span>nframes <span class="token operator">=</span> nframes</span>
<span class="line">    newnode<span class="token operator">.</span>next <span class="token operator">=</span> <span class="token keyword">nil</span></span>
<span class="line">    head <span class="token operator">=</span> newnode</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">elif</span> prev<span class="token operator">.</span>isNil <span class="token operator">and</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>paddr<span class="token punctuation">,</span> nframes<span class="token punctuation">,</span> curr<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;pmFree: at the beginning, adjacent to curr&quot;</span></span>
<span class="line">    <span class="token comment"># at the beginning, adjacent to curr</span></span>
<span class="line">    <span class="token keyword">var</span> newnode <span class="token operator">=</span> paddr<span class="token operator">.</span>toPMNodePtr</span>
<span class="line">    newnode<span class="token operator">.</span>nframes <span class="token operator">=</span> nframes <span class="token operator">+</span> curr<span class="token operator">.</span>nframes</span>
<span class="line">    newnode<span class="token operator">.</span>next <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line">    head <span class="token operator">=</span> newnode</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">elif</span> curr<span class="token operator">.</span>isNil <span class="token operator">and</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>prev<span class="token punctuation">,</span> paddr<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;pmFree: at the end, adjacent to prev&quot;</span></span>
<span class="line">    <span class="token comment"># at the end, adjacent to prev</span></span>
<span class="line">    prev<span class="token operator">.</span>nframes <span class="token operator">+=</span> nframes</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">elif</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>prev<span class="token punctuation">,</span> paddr<span class="token punctuation">)</span> <span class="token operator">and</span> <span class="token function">adjacent</span><span class="token punctuation">(</span>paddr<span class="token punctuation">,</span> nframes<span class="token punctuation">,</span> curr<span class="token punctuation">)</span><span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;pmFree: exactly between prev and curr&quot;</span></span>
<span class="line">    <span class="token comment"># exactly between prev and curr</span></span>
<span class="line">    prev<span class="token operator">.</span>nframes <span class="token operator">+=</span> nframes <span class="token operator">+</span> curr<span class="token operator">.</span>nframes</span>
<span class="line">    prev<span class="token operator">.</span>next <span class="token operator">=</span> curr<span class="token operator">.</span>next</span>
<span class="line"></span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    <span class="token comment"># not adjacent to any other region</span></span>
<span class="line">    debugln <span class="token string">&quot;pmFree: not adjacent to any other region&quot;</span></span>
<span class="line">    <span class="token keyword">var</span> newnode <span class="token operator">=</span> paddr<span class="token operator">.</span>toPMNodePtr</span>
<span class="line">    newnode<span class="token operator">.</span>nframes <span class="token operator">=</span> nframes</span>
<span class="line">    newnode<span class="token operator">.</span>next <span class="token operator">=</span> curr</span>
<span class="line">    <span class="token keyword">if</span> <span class="token operator">not</span> prev<span class="token operator">.</span>isNil<span class="token operator">:</span></span>
<span class="line">      prev<span class="token operator">.</span>next <span class="token operator">=</span> newnode</span>
<span class="line">    <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">      head <span class="token operator">=</span> newnode</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try it out by allocating and freeing some regions.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Allocating 8 frames&quot;</span></span>
<span class="line">  <span class="token keyword">let</span> paddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">8</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">if</span> paddr<span class="token operator">.</span>isNone<span class="token operator">:</span></span>
<span class="line">    debugln <span class="token string">&quot;kernel: Allocation failed&quot;</span></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Freeing 2 frames at 0x2000&quot;</span></span>
<span class="line">  <span class="token function">pmFree</span><span class="token punctuation">(</span><span class="token number">0x2000</span><span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> <span class="token number">2</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Freeing 4 frames at 0x4000&quot;</span></span>
<span class="line">  <span class="token function">pmFree</span><span class="token punctuation">(</span><span class="token number">0x4000</span><span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> <span class="token number">4</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Freeing 2 frames at 0xa0000&quot;</span></span>
<span class="line">  <span class="token function">pmFree</span><span class="token punctuation">(</span><span class="token number">0xa0000</span><span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span> <span class="token number">2</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token function">printFreeRegions</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we run the kernel now, we should see something like this:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Initializing physical memory manager [success]</span>
<span class="line">kernel: Physical memory free regions</span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">                0x0              0           640         160</span>
<span class="line">           0x223000           2188          6004        1501</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124292 KiB (121 MiB)</span>
<span class="line">kernel: Allocating 8 frames</span>
<span class="line">kernel: Physical memory free regions</span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">             0x8000             32           608         152</span>
<span class="line">           0x223000           2188          6004        1501</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124260 KiB (121 MiB)</span>
<span class="line">kernel: Freeing 2 frames at 0x2000</span>
<span class="line">pmFree: not adjacent to any other region</span>
<span class="line">kernel: Physical memory free regions</span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">             0x2000              8             8           2</span>
<span class="line">             0x8000             32           608         152</span>
<span class="line">           0x223000           2188          6004        1501</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124268 KiB (121 MiB)</span>
<span class="line">kernel: Freeing 4 frames at 0x4000</span>
<span class="line">pmFree: exactly between prev and curr</span>
<span class="line">kernel: Physical memory free regions</span>
<span class="line">              Start     Start (KB)     Size (KB)      #Pages</span>
<span class="line">             0x2000              8           632         158</span>
<span class="line">           0x223000           2188          6004        1501</span>
<span class="line">           0x808000           8224            12           3</span>
<span class="line">           0x80c000           8240            16           4</span>
<span class="line">           0x900000           9216         92596       23149</span>
<span class="line">          0x6372000         101832         17900        4475</span>
<span class="line">          0x77ff000         122876          7124        1781</span>
<span class="line">kernel: Total free: 124284 KiB (121 MiB)</span>
<span class="line">kernel: Freeing 2 frames at 0xa0000</span>
<span class="line"></span>
<span class="line">Unhandled exception: Attempt to free a reserved region.</span>
<span class="line">  Request: start=0xa0000, nframes=2</span>
<span class="line">  Reserved: start=0xa0000, nframes=96 [Exception]</span>
<span class="line"></span>
<span class="line">Stack trace:</span>
<span class="line">/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(46) KernelMain</span>
<span class="line">/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(85) KernelMainInner</span>
<span class="line">/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/pmm.nim(164) pmFree</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>First we allocate 8 frames (starting at 0x0000), then we free 2 frames at 0x2000, and finally we free 4 frames at 0x4000. The request to free the region at 0x2000 is not adjacent to any other free region, so it&#39;s inserted in the list. The second region being freed at 0x4000 is now exactly between the first free region (ending at 0x4000) and the second free region (starting at 0x8000), so it&#39;s merged with them.</p><p>In the last free request, we try to free 2 frames at 0xa0000, which is a reserved region, so an exception is raised, which is exactly what we want. I&#39;m not going to show all possible scenarios here, but I tested them and they all work as expected.</p><p>Phew! That was a lot of work, but we now have a working PMM. In the next chapter, we&#39;ll start looking at virtual memory.</p>`,57)])])}const r=n(l,[["render",i],["__file","11-physical-memory.html.vue"]]),c=JSON.parse(`{"path":"/osdev/11-physical-memory.html","title":"Physical Memory","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Free List","slug":"free-list","link":"#free-list","children":[]},{"level":2,"title":"Initialization","slug":"initialization","link":"#initialization","children":[]},{"level":2,"title":"Allocating Frames","slug":"allocating-frames","link":"#allocating-frames","children":[]},{"level":2,"title":"Freeing Frames","slug":"freeing-frames","link":"#freeing-frames","children":[]}],"git":{"updatedTime":1744638230000},"filePathRelative":"osdev/11-physical-memory.md","excerpt":"\\n<p>Managing physical memory involves being able to allocate and free physical page frames.\\nWe'll create a <strong>Physical Memory Manager</strong> (PMM) that will keep track of which physical\\npages are free and which are in use. There are many ways to implement a PMM, the most\\npopular being a bitmap, a free list, and a free stack. I'll keep it simple and implement a\\nfree list.</p>"}`);export{r as comp,c as data};
