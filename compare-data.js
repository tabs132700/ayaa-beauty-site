/* Before/after pairs. Add a pair = add one object here; no other code changes.
   caption: 'illustration' | 'consent' | { nl:'', ar:'', en:'' }
   Leave beforeSrc/afterSrc empty ('') to show a [ADD BEFORE/AFTER IMAGE] placeholder.
   Optional: w / h = pixel size of the images (default 1254 x 1254). */
window.COMPARE_PAIRS = [
  {
    treatmentId: 'hydrofacial',
    beforeSrc: 'img/r-ba-hydro-before.webp',
    afterSrc: 'img/r-ba-hydro.webp',
    altBefore: {
      nl: 'Close-up van een gezicht met een wat doffe, ongelijkmatige huidtextuur',
      ar: 'لقطة قريبة لوجه ببشرة باهتة وملمس غير متجانس',
      en: 'Close-up of a face with dull, slightly uneven skin texture'
    },
    altAfter: {
      nl: 'Hetzelfde gezicht met een gladdere, egalere en stralendere huid',
      ar: 'الوجه نفسه ببشرة أكثر نعومة وتجانسًا وإشراقًا',
      en: 'The same face with smoother, more even, glowing skin'
    },
    caption: 'illustration'
  },
  {
    treatmentId: 'rf',
    beforeSrc: 'img/r-ba-rf-before.webp',
    afterSrc: 'img/r-ba-rf.webp',
    altBefore: {
      nl: 'Gezicht en hals met zichtbare fijne lijntjes en een slappere huid',
      ar: 'الوجه والرقبة مع خطوط دقيقة ظاهرة وبشرة أقل شدًّا',
      en: 'Face and neck with visible fine lines and looser skin'
    },
    altAfter: {
      nl: 'Hetzelfde gezicht en dezelfde hals met een gladdere, steviger ogende huid',
      ar: 'الوجه والرقبة نفسهما ببشرة أكثر نعومة وشدًّا',
      en: 'The same face and neck with smoother, firmer-looking skin'
    },
    caption: 'illustration'
  },
  {
    treatmentId: 'laser',
    w: 832, h: 1248,
    beforeSrc: 'img/r-ba-laser-before.webp',
    afterSrc: 'img/r-ba-laser.webp',
    altBefore: {
      nl: 'Onderbenen en knieën met dichte, donkere beharing',
      ar: 'الساقان والركبتان مع نمو كثيف للشعر الداكن',
      en: 'Lower legs and knees with dense, dark hair growth'
    },
    altAfter: {
      nl: 'Dezelfde benen met gladde, haarvrije huid',
      ar: 'الساقان نفسهما ببشرة ناعمة خالية من الشعر',
      en: 'The same legs with smooth, hair-free skin'
    },
    caption: 'illustration'
  },
  {
    treatmentId: 'cavitation',
    beforeSrc: 'img/r-ba-cavi-before.webp',
    afterSrc: 'img/r-ba-cavi.webp',
    altBefore: {
      nl: 'Staande vrouw, bovenbenen met zichtbaar oneffen huid (cellulitis)',
      ar: 'امرأة واقفة، الفخذان ببشرة غير مستوية ظاهرة (سيلوليت)',
      en: 'Standing woman, thighs with visible dimpled skin (cellulite)'
    },
    altAfter: {
      nl: 'Dezelfde benen met een gladdere huid',
      ar: 'الساقان نفسهما ببشرة أكثر نعومة',
      en: 'The same legs with smoother skin'
    },
    caption: 'illustration'
  },
  {
    treatmentId: 'oxygen',
    beforeSrc: 'img/r-ba-o2-before.webp',
    afterSrc: 'img/r-ba-o2.webp',
    altBefore: {
      nl: 'Gezicht met een droge, onregelmatige huid en fijne lijntjes',
      ar: 'وجه ببشرة جافة وملمس غير منتظم وخطوط دقيقة',
      en: 'Face with dry, textured skin and fine lines'
    },
    altAfter: {
      nl: 'Hetzelfde gezicht met een gladdere, stralendere huid',
      ar: 'الوجه نفسه ببشرة أكثر نعومة وإشراقًا',
      en: 'The same face with smoother, more radiant skin'
    },
    caption: 'illustration'
  }
];
