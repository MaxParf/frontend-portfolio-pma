// =========================================================
// 1. Google Tag (gtag.js) / Google Analytics
// =========================================================

(function() {
    var script = document.createElement('script');
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-STJSYF0ZTP";
    document.head.appendChild(script);
})();

// Инициализация Google Tag
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-STJSYF0ZTP');


// =========================================================
// 2. Yandex.Metrika counter
// =========================================================

// Код счетчика Metrika
(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    // Избегаем повторной вставки скрипта (часть кода Metrika)
    // В отличие от оригинального кода, здесь мы не ищем существующие скрипты, 
    // так как предполагаем, что этот файл `analytics.js` загружается только один раз.
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=104218170', 'ym');

// Инициализация Metrika
ym(104218170, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});