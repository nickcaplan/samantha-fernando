/* Shared by the static build and browser enhancements. No DOM or provider access. */
(function (root) {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const categories = {chamber: 'Solo & Chamber', vocal: 'Vocal & Choral', ensemble: 'Large Ensemble', opera: 'Opera & Stage', orchestral: 'Orchestral'};
    function renderCatalogueCards(data, view = 'all', search = '', category = 'all') {
        const {works, media} = data;
        const related = item => works.find(work => work.id === item.workId);
        const action = item => {
            const index = media.indexOf(item);
            if (item.type === 'watch') return `<button type="button" aria-label="Watch ${escape(item.title)}" data-media-index="${index}" class="work-media-action"><i class="fa-solid fa-play text-[10px]" aria-hidden="true"></i> ${escape(item.actionLabel || 'Watch')}</button>`;
            const attribute = item.provider === 'spotify' ? 'data-spotify-track' : 'data-track';
            return `<button type="button" ${attribute}="${escape(item.id)}" data-media-index="${index}" class="work-media-action"><i class="fa-solid fa-play text-[10px]" aria-hidden="true"></i> ${item.provider === 'spotify' ? 'Preview' : 'Listen'}</button>`;
        };
        const items = (view === 'all' ? works : media.filter(item => item.type === view)).filter(item => {
            const work = view === 'all' ? item : related(item);
            const text = view === 'all'
                ? `${item.title} ${item.instrumentation} ${categories[item.category]} ${item.commission || ''} ${item.premiere || ''} ${item.notes || ''}`
                : `${item.title} ${item.detail} ${work?.instrumentation || ''} ${work?.title || ''}`;
            return text.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || (work?.category || item.category) === category);
        }).sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
        if (!items.length) return `<div class="glass-panel p-8 text-center text-neutral-500 font-mono text-xs rounded-2xl">No ${view === 'all' ? 'compositions' : view === 'listen' ? 'recordings' : 'films'} found matching your search query.</div>`;
        return items.map(item => {
            if (view === 'watch') {
                const videoId = new URL(item.url).searchParams.get('v');
                return `<article class="glass-panel p-4 rounded-2xl border border-neutral-800 hover:border-amber-700/50 transition-all flex flex-col gap-4 group">
                    <button type="button" data-media-index="${media.indexOf(item)}" aria-label="Watch ${escape(item.title)}" class="relative aspect-video overflow-hidden rounded-xl bg-neutral-900 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                        <img src="https://i.ytimg.com/vi/${escape(videoId)}/hqdefault.jpg" alt="" class="w-full h-full object-cover" loading="lazy">
                        <span class="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors"><span class="w-14 h-14 rounded-full bg-amber-600/90 text-white flex items-center justify-center text-xl shadow-xl transition-transform group-hover:scale-110"><i class="fa-solid fa-play ml-1" aria-hidden="true"></i></span></span>
                    </button><div class="space-y-1"><div class="flex items-center gap-3"><span class="text-xs font-mono text-amber-400">${escape(item.year || 'Undated')}</span></div>
                    <h3 class="text-xl font-serif text-neutral-100 group-hover:text-amber-300 transition-colors">${escape(item.title).replaceAll('/', '/<wbr>')}</h3><p class="text-xs text-neutral-400 leading-relaxed">${escape(item.detail)}</p></div></article>`;
            }
            const work = view === 'all' ? item : related(item);
            const actions = view === 'all' ? media.filter(entry => entry.workId === item.id).sort((a, b) => (a.actionOrder || 0) - (b.actionOrder || 0) || a.key.localeCompare(b.key)) : [item];
            return `<div class="glass-panel p-5 rounded-2xl border border-neutral-800 hover:border-amber-700/50 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 group">
                <div class="space-y-1"><div class="flex flex-wrap items-center gap-3"><span class="text-xs font-mono text-amber-400">${escape(item.year || 'Undated')}</span>
                ${work ? `<span class="px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono">${categories[work.category]}</span>` : ''}
                ${item.duration ? `<span class="text-xs font-mono text-neutral-500">${escape(item.duration)}</span>` : ''}</div>
                <h3 class="text-lg font-serif text-neutral-100 group-hover:text-amber-300 transition-colors">${escape(item.title).replaceAll('/', '/<wbr>')}</h3>
                <p class="text-xs text-neutral-400">${escape(view === 'all' ? item.instrumentation : item.detail)}</p>
                ${view === 'all' ? `<div class="space-y-0.5 pt-1 text-xs text-neutral-500 font-serif-italic">${['commission', 'premiere', 'notes'].map(field => item[field] ? `<p>${field !== 'notes' ? `<span class="not-italic font-sans text-[10px] uppercase tracking-wider text-neutral-600">${field === 'commission' ? 'Commission' : 'Premiere'}</span> ` : ''}${escape(item[field])}</p>` : '').join('')}</div>` : ''}</div>
                <div class="${view === 'all' ? `work-media-actions ${actions.length > 1 ? 'work-media-actions--multiple' : ''}` : 'media-catalog-actions flex items-center gap-2 pt-2 md:pt-0 md:mt-auto'}">${actions.map(action).join('')}</div></div>`;
        }).join('');
    }
    if (typeof module !== 'undefined') module.exports = {renderCatalogueCards};
    else root.renderCatalogueCards = renderCatalogueCards;
})(typeof window === 'undefined' ? globalThis : window);
