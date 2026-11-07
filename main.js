(()=>{
  'use strict';
  const $=(s)=>document.querySelector(s);
  const $$=(s)=>Array.from(document.querySelectorAll(s));
  const menu=$('.menu-toggle'); const nav=$('#main-nav');
  const closeMenu=()=>{if(!menu||!nav)return;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Открыть меню');nav.classList.remove('is-open');document.body.classList.remove('nav-open')};
  menu?.addEventListener('click',()=>{const next=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(next));menu.setAttribute('aria-label',next?'Закрыть меню':'Открыть меню');nav.classList.toggle('is-open',next);document.body.classList.toggle('nav-open',next)});
  $$('#main-nav a').forEach(a=>a.addEventListener('click',closeMenu));
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  window.addEventListener('resize',()=>{if(window.innerWidth>900)closeMenu()});
  $('#year').textContent=String(new Date().getFullYear());
  // Показываем ненавязчивую строку связи после первого экрана.
  const floating=$('.mobile-sticky-cta');
  const updateFloating=()=>{const hero=$('.hero');const threshold=(hero?.getBoundingClientRect().bottom||0)<-50;const contact=document.querySelector('#contact');const contactVisible=contact&&contact.getBoundingClientRect().top<window.innerHeight-80;floating?.classList.toggle('is-visible',window.innerWidth<=680&&threshold&&!contactVisible)};
  window.addEventListener('scroll',updateFloating,{passive:true});window.addEventListener('resize',updateFloating);updateFloating();
  // При выборе проблемы автоматически выставляем тему в форме.
  $$('a[data-reason]').forEach(link=>link.addEventListener('click',()=>{
    const reason=link.getAttribute('data-reason')||''; const select=$('#lead-type');
    const option=Array.from(select.options).find(o=>o.value===reason);
    if(option)select.value=option.value; else if(reason.startsWith('Хочу'))select.value='Другой вопрос';
  }));
  // Раскрываем один вопрос FAQ за раз.
  $$('.faq-list details').forEach(detail=>detail.addEventListener('toggle',()=>{
    if(detail.open)$$('.faq-list details').forEach(other=>{if(other!==detail)other.open=false});
  }));

  const form=$('#lead-form'); const state=$('#form-state'); const submit=$('#lead-submit');
  const errors={name:$('#err-name'),phone:$('#err-phone'),city:$('#err-city'),message:$('#err-message'),consent:$('#err-consent')};
  const fieldIds={name:'lead-name',phone:'lead-phone',city:'lead-city',message:'lead-message',consent:'lead-consent'};
  const started=$('#form-started'); if(started)started.value=String(Date.now());
  const values=()=>({name:$('#lead-name').value.trim(),phone:$('#lead-phone').value.trim(),city:$('#lead-city').value,topic:$('#lead-type').value,message:$('#lead-message').value.trim(),consent:$('#lead-consent').checked,website:$('#site-url').value,startedAt:Number(started?.value||0)});
  function markError(name,message){const el=$('#'+fieldIds[name]);if(el){el.setAttribute('aria-invalid',message?'true':'false');if(message)el.setAttribute('aria-describedby','err-'+name);else el.removeAttribute('aria-describedby')}if(errors[name])errors[name].textContent=message}
  function validate(v){Object.keys(errors).forEach(k=>markError(k,''));let ok=true;
    const invalid=(k,m)=>{markError(k,m);ok=false};
    if(v.name.length<2)invalid('name','Укажите имя — минимум 2 символа.');
    if(v.name.length>100)invalid('name','Имя слишком длинное.');
    if(v.phone.replace(/\D/g,'').length<10||v.phone.replace(/\D/g,'').length>15)invalid('phone','Проверьте телефон: от 10 до 15 цифр.');
    if(!v.city)invalid('city','Выберите регион.');
    if(v.message.length<10)invalid('message','Кратко опишите ситуацию — минимум 10 символов.');
    if(v.message.length>2500)invalid('message','Описание не должно превышать 2500 символов.');
    if(!v.consent)invalid('consent','Подтвердите согласие.');return ok;
  }
  for(const name of Object.keys(fieldIds)){
    const el=$('#'+fieldIds[name]);if(!el)continue;
    el.addEventListener(name==='consent'||name==='city'?'change':'input',()=>{markError(name,'');state.textContent='';state.className='form-state'});
  }
  $('#lead-type').addEventListener('change',()=>{state.textContent='';state.className='form-state'});
  form?.addEventListener('submit',async e=>{
    e.preventDefault();state.textContent='';state.className='form-state';
    const v=values();
    if(!validate(v)){state.textContent='Проверьте выделенные поля.';form.querySelector('[aria-invalid="true"]')?.focus();return}
    if(v.website){return;} // Hidden honeypot.
    const endpoint=window.OPORA_CONFIG?.formEndpoint||'/api/submit-lead';
    submit.disabled=true;
    const caption=submit.innerHTML;submit.textContent='Отправляем заявку…';
    state.textContent='Отправляем обращение. Пожалуйста, не закрывайте страницу.';
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),16000);
    try{
      const response=await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(v),signal:abort.signal,credentials:'same-origin'
      });
      let result={};try{result=await response.json()}catch{}
      if(!response.ok||result.ok!==true)throw new Error(result.message||'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.');
      state.className='form-state is-success';
      state.textContent='Спасибо! Заявка принята к отправке. Мы свяжемся с вами по указанному телефону.';
      form.reset();if(started)started.value=String(Date.now());
    }catch(err){
      state.className='form-state is-error';
      if(location.protocol==='file:')state.textContent='Для отправки заявки откройте сайт по опубликованному HTTPS-адресу. Пока можно позвонить нам.';
      else if(err.name==='AbortError')state.textContent='Время ожидания истекло. Проверьте соединение или позвоните нам.';
      else state.textContent='Отправка сейчас недоступна. Попробуйте позже или позвоните нам.';
    }finally{clearTimeout(timeout);submit.disabled=false;submit.innerHTML=caption;}
  });
})();
