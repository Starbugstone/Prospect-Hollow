<template>
  <svg viewBox="0 0 160 130" aria-hidden="true" class="personal-design-art">
    <defs>
      <linearGradient :id="gradient" x2="0" y2="1">
        <stop :stop-color="lunar ? '#17253f' : '#f7f0dc'" />
        <stop offset="1" :stop-color="lunar ? '#536579' : '#dbe6d1'" />
      </linearGradient>
    </defs>
    <rect v-if="!map" width="160" height="130" rx="12" :fill="`url(#${gradient})`" />
    <ellipse v-if="!map" cx="80" cy="114" rx="69" ry="10" fill="#bac7af" />
    <path d="M19 108 80 95 142 108 80 125Z" :fill="walls" stroke="#91785e" />
    <g
      v-if="!timeless && !lunar && !mineral && level >= 4"
      fill="#ddd1b5"
      stroke="#91785e"
      stroke-width="2"
    >
      <path d="M12 112V44h8v68M38 112V44h8v68M114 112V44h8v68M140 112V44h8v68M8 38h144v8H8Z" />
      <path d="M8 36h144" stroke="#cc954f" stroke-width="4" />
    </g>
    <g
      v-if="!timeless && !lunar && !mineral && level >= 2"
      :fill="option.colour"
      stroke="#655343"
      stroke-width="2"
    >
      <path d="M9 110V82h26v28M125 110V82h26v28M6 78h32v5H6ZM122 78h32v5h-32Z" />
    </g>
    <g
      :transform="
        timeless
          ? undefined
          : `translate(80 112) scale(${0.76 + level * 0.048}) translate(-80 -112)`
      "
      :class="{ 'landmark-active': active }"
      :fill="option.colour"
      :stroke="trim"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <template v-if="form === 'moonstone-fountain'">
        <path d="M25 106v-9h110v9ZM43 83v-8h74v8ZM60 61v-7h40v7Z" fill="#aaa79f" />
        <ellipse cx="80" cy="96" rx="54" ry="8" />
        <ellipse cx="80" cy="74" rx="36" ry="6" />
        <path d="m80 22 9 18-9 16-9-16Z" />
        <path d="M48 87V61m64 26V61" stroke="#a6cfdf" stroke-width="3" />
      </template>
      <template v-else-if="form === 'homeward-obelisk'">
        <path d="M63 108 57 37 80 9l23 28-6 71Z" />
        <path d="M80 9v99" stroke="#e5e8e7" />
        <ellipse
          cx="80"
          cy="66"
          rx="43"
          ry="15"
          fill="none"
          stroke="#b8a4d8"
          stroke-width="5"
          transform="rotate(-25 80 66)"
        />
      </template>
      <template v-else-if="form === 'lunar-pavilion'">
        <path d="M38 108V58h8v50Zm76 0V58h8v50ZM54 99V54h7v45Zm45 0V54h7v45Z" />
        <path d="m22 58 58-43 58 43Z" fill="#b8a4d8" />
        <path d="m80 15-20 43h40Z" />
        <path d="m80 70 10 17-10 20-10-20Z" />
      </template>
      <template v-else-if="form === 'moonstone-henge'">
        <g fill="#aaa79f">
          <path d="M25 103V46h15v57Zm35-12V28h15v63Zm38 0V28h15v63Zm22 12V46h15v57Z" />
          <path d="M20 40h25v10H20ZM55 22h63v12H55ZM115 40h25v10h-25Z" />
        </g>
        <path d="m80 73 10 17-10 19-10-19Z" />
        <path d="m27 39 6-16 6 16Zm96 0 6-16 6 16Z" />
      </template>
      <template v-else-if="form === 'earthlight-spire'">
        <path d="M59 110 40 40 56 12l19 26 1 72Z" fill="#b8a4d8" />
        <path d="m84 110 1-72 19-26 16 28-19 70Z" />
        <path d="m27 108 4-22 6 22Zm94 0 6-22 4 22Z" />
        <path d="M56 12l12 98M104 12l-12 98" stroke="#e5e8e7" />
      </template>
      <template v-else-if="form === 'crater-amphitheatre'">
        <g fill="none" stroke="#aaa79f" stroke-width="10">
          <path d="M23 92a57 45 0 1 1 114 0M37 92a43 32 0 1 1 86 0M51 92a29 20 0 1 1 58 0" />
        </g>
        <ellipse cx="80" cy="98" rx="25" ry="8" fill="#b8a4d8" />
        <path d="m80 65 9 16-9 17-9-17Z" />
      </template>
      <template v-else-if="form === 'footprints'">
        <ellipse cx="80" cy="105" rx="48" ry="10" fill="#aaa79f" />
        <path d="M51 99v-7h7v7Zm15-9v-7h7v7Zm-15-9v-7h7v7Z" fill="#657481" />
        <path d="M93 99V42m0 0h26v18H93" stroke="#eacb80" stroke-width="3" />
        <path
          d="M32 105V80a48 52 0 0 1 96 0v25Z"
          fill="#a4dbea"
          fill-opacity=".28"
          stroke="#e5e8e7"
          stroke-width="3"
        />
        <path d="M80 28Q50 45 51 108M80 28q30 17 29 80" fill="none" stroke="#e5e8e7" />
        <circle class="landmark-glint" cx="80" cy="23" r="4" fill="#eacb80" />
      </template>
      <template v-else-if="form === 'earthrise'">
        <path
          d="M35 110V59a45 36 0 0 1 90 0v51h-13V59a32 23 0 0 0-64 0v51Z"
          fill="#aaa79f"
          stroke="#e5e8e7"
          stroke-width="3"
        />
        <path d="m29 53 8-24 9 24-8 16Zm86 0 8-24 9 24-8 16Z" />
        <circle cx="80" cy="65" r="14" fill="#4f8fc7" />
        <path d="m73 57 9-2 4 6-7 3-4 7-6-6Z" fill="#89b799" stroke="none" />
        <path d="M64 110v-7h32v7" fill="#eacb80" />
      </template>
      <template v-else-if="form === 'orbital-beacon'">
        <path d="M77 110V60h6v50Z" fill="#657481" />
        <g class="landmark-orbits" fill="none" stroke-width="5">
          <ellipse cx="80" cy="54" rx="44" ry="20" transform="rotate(-34 80 54)" />
          <ellipse cx="80" cy="54" rx="44" ry="20" transform="rotate(34 80 54)" stroke="#eacb80" />
        </g>
        <circle cx="80" cy="54" r="10" fill="#e5e8e7" />
        <circle cx="118" cy="34" r="5" />
        <path d="m75 19 5-17 5 17Z" fill="#eacb80" />
      </template>
      <template v-else-if="form === 'arch'">
        <path d="M35 109V48h20v61ZM105 109V48h20v61Z" />
        <path d="M47 50a33 33 0 0 1 66 0H99a19 19 0 0 0-38 0Z" />
        <circle class="landmark-glint" cx="80" cy="17" r="8" :fill="accent" />
      </template>
      <template v-else-if="form === 'crystal'">
        <path
          d="m70 109-7-72 17-27 17 27-7 72ZM39 109 27 65 40 48 53 69 58 114ZM103 111l-2-57 16-17 15 24-10 48Z"
        />
        <path
          class="landmark-glint"
          d="M80 10v101M40 48l8 64M117 37l-5 73"
          fill="none"
          stroke="#ded4f0"
        />
      </template>
      <template v-else-if="form === 'guardian'">
        <path class="landmark-wing" d="M59 100 25 47l10-13 30 21M101 100l34-53-10-13-30 21" />
        <path d="M58 95 51 46 54 22l20 15h12l20-15 3 24-7 49Z" />
        <circle cx="66" cy="53" r="12" fill="#f4ead5" />
        <circle cx="94" cy="53" r="12" fill="#f4ead5" />
        <circle cx="66" cy="53" r="5" fill="#655343" />
        <circle cx="94" cy="53" r="5" fill="#655343" />
        <path d="m74 65 6 12 6-12Z" fill="#655343" />
        <path d="M55 113V96h50v17" fill="#91785e" />
      </template>
      <template v-else-if="form === 'tree'">
        <path
          d="M74 113V61L42 40m38 41 36-31M80 62V24"
          fill="none"
          stroke="#b77839"
          stroke-width="9"
        />
        <ellipse class="landmark-bough" cx="45" cy="41" rx="30" ry="20" />
        <ellipse class="landmark-bough" cx="111" cy="44" rx="29" ry="23" />
        <ellipse cx="80" cy="25" rx="30" ry="21" />
        <path d="M39 115h82" stroke="#cc954f" stroke-width="5" />
      </template>
      <template v-else-if="form === 'orrery'">
        <path d="M54 112V86h52v26" :fill="walls" />
        <circle cx="80" cy="54" r="18" />
        <g class="landmark-orbits" fill="none" stroke="#cc954f" stroke-width="4">
          <ellipse cx="80" cy="54" rx="51" ry="19" transform="rotate(-28 80 54)" />
          <ellipse cx="80" cy="54" rx="21" ry="49" transform="rotate(-25 80 54)" />
          <ellipse cx="80" cy="54" rx="48" ry="30" transform="rotate(33 80 54)" />
        </g>
        <circle cx="127" cy="36" r="6" :fill="accent" />
      </template>
      <template v-else-if="form === 'headframe'">
        <path d="M20 110V82h30v28Z" :fill="walls" />
        <path d="m15 84 20-15 20 15Z" fill="#655343" />
        <path d="M50 110 73 26h14l23 84" fill="none" :stroke="option.colour" stroke-width="7" />
        <path d="M64 110 77 46m19 64L83 46" fill="none" :stroke="option.colour" stroke-width="4" />
        <circle cx="80" cy="24" r="15" fill="none" stroke="#655343" stroke-width="4" />
        <path d="M80 9v30M65 24h30" stroke="#cc954f" stroke-width="2" />
        <path d="M108 108V93h34v15Z" fill="#655343" />
        <circle cx="117" cy="89" r="5" fill="#9b91c4" />
        <circle cx="126" cy="87" r="6" fill="#76b0a6" />
        <circle cx="135" cy="90" r="5" fill="#cc954f" />
      </template>
      <template v-else-if="form === 'windpump'">
        <path d="M64 111 76 40h8l12 71M68 88h24M72 64h16" fill="none" stroke-width="4" />
        <path
          d="M80 34V12m0 22 16-16m-16 16h22m-22 0 16 16m-16-16v22m0-22L64 50m16-16H58m22 0L64 18"
          :stroke="option.colour"
          stroke-width="7"
        />
        <circle cx="80" cy="34" r="23" fill="none" stroke-width="3" />
        <path d="M86 30h36l-6 8H86Z" />
        <path d="M108 111V80h28v31Z" fill="#9c6a3c" />
        <path d="M18 111v-8h36v8Z" fill="#8a5a34" />
        <path d="M22 103a5 5 0 0 1 10 0m2 0a5 5 0 0 1 10 0m2 0a5 5 0 0 1 8 0" fill="#8caf80" />
      </template>
      <template v-else-if="form === 'hall'">
        <path d="M19 108V56h47v49M94 105V56h47v52" :fill="walls" />
        <path d="m13 58 29-29 30 29ZM88 58l30-29 30 29Z" />
        <path d="M14 85h132v10H14Z" />
        <path d="M23 96v16M49 96v16M80 96v16M112 96v16M138 96v16" stroke-width="5" />
        <path
          d="M27 62h11v16H27ZM47 62h11v16H47ZM102 62h11v16h-11ZM122 62h11v16h-11Z"
          fill="#a0ccc4"
        />
      </template>
      <template v-else-if="form === 'station'">
        <path
          d="M80 54V22M80 54 57 31m23 23 23-23M80 54H48m32 0h32"
          stroke="#cc954f"
          stroke-width="3"
        />
        <path d="M58 54a22 22 0 0 1 44 0Z" fill="#cc954f" />
        <path d="M14 54h132v12H14Z" />
        <path d="M28 66v45m104-45v45" stroke="#ddd1b5" stroke-width="5" />
        <path d="M52 111V86h12v25ZM96 111V86h12v25Z" />
        <path d="M74 111V86h12v25Z" fill="#41658f" />
        <circle cx="58" cy="81" r="5" fill="#f5ddb0" />
        <circle cx="80" cy="81" r="5" fill="#f5ddb0" />
        <circle cx="102" cy="81" r="5" fill="#f5ddb0" />
      </template>
      <template v-else-if="form === 'diner'">
        <path d="M134 111V36" stroke-width="5" />
        <circle cx="134" cy="30" r="12" fill="#bd705f" />
        <rect x="14" y="66" width="108" height="42" rx="21" />
        <path d="M26 82h84" stroke="#a0ccc4" stroke-width="11" />
        <path d="M17 96h102" stroke="#d9dee2" stroke-width="4" />
        <path d="M8 62h120v6H8Z" fill="#ddd1b5" />
        <path d="M48 48h40v14H48Z" fill="#bd705f" />
      </template>
      <template v-else-if="form === 'screen'">
        <path d="M38 111V70m84 41V70" stroke-width="6" />
        <rect x="24" y="16" width="112" height="58" rx="3" fill="#393c43" />
        <path d="M30 22h17v46H30Z" fill="#f5ddb0" />
        <path d="M47 22h17v46H47Z" fill="#e8bf79" />
        <path d="M64 22h16v46H64Z" fill="#52948e" />
        <path d="M80 22h16v46H80Z" fill="#8caf80" />
        <path d="M96 22h17v46H96Z" fill="#bd705f" />
        <path d="M113 22h17v46h-17Z" />
        <path d="M40 111v-9h80v9Z" :fill="walls" />
        <path d="M6 111V80h22v31Zm126 0V80h22v31Z" fill="#393c43" />
      </template>
      <template v-else-if="form === 'dome'">
        <path d="M35 109V61h90v48Z" :fill="walls" />
        <path d="M27 62a53 42 0 0 1 106 0Z" />
        <path
          d="M39 64v45M56 64v49M80 64v51M104 64v49M121 64v45"
          stroke="#91785e"
          stroke-width="5"
        />
        <path d="m89 33 21-18" :stroke="trim" stroke-width="8" />
      </template>
      <template v-else-if="form === 'solar'">
        <ellipse cx="80" cy="108" rx="54" ry="7" fill="none" stroke="#8caf80" stroke-width="6" />
        <path d="M76 111V40h8v71Z" :fill="walls" />
        <path d="m64 111 16-18 16 18Z" :fill="walls" />
        <g fill="#41658f">
          <path d="m80 40-54-8 6 13ZM80 40l54-8-6 13ZM80 40 50 8l-2 14ZM80 40l30-32 2 14Z" />
        </g>
        <g fill="#52948e">
          <path d="m80 40-46-26 2 14ZM80 40l46-26-2 14ZM80 40 72 2l-8 12ZM80 40l8-38 8 12Z" />
        </g>
        <circle cx="80" cy="40" r="7" />
      </template>
      <template v-else-if="form === 'loop'">
        <path d="M10 108h140" :stroke="option.colour" stroke-width="7" />
        <circle cx="80" cy="60" r="44" fill="none" :stroke="option.colour" stroke-width="10" />
        <circle cx="80" cy="60" r="36" fill="none" stroke="#f5ddb0" stroke-width="3" />
        <ellipse cx="114" cy="26" rx="18" ry="9" transform="rotate(45 114 26)" fill="#ddd1b5" />
        <ellipse cx="114" cy="26" rx="11" ry="5" transform="rotate(45 114 26)" fill="#a0ccc4" />
      </template>
      <template v-else-if="form === 'glass'">
        <path d="M18 109V69h34v40M108 109V69h34v40M50 111V52h60v59" fill="#a0ccc4" />
        <path d="M13 69a22 23 0 0 1 44 0ZM103 69a22 23 0 0 1 44 0ZM46 52a34 35 0 0 1 68 0Z" />
        <path
          d="M24 72v36M46 72v36M61 57v55M80 54v61M99 57v55M117 72v36M136 72v36"
          stroke-width="3"
        />
      </template>
      <template v-else-if="form === 'theatre'">
        <path d="m30 75-7-44 17-9 19 25 9-33h24l9 33 19-25 17 9-7 44Z" />
        <path
          d="M25 92q55 24 110 0v14q-55 24-110 0ZM35 82q45 19 90 0v10q-45 23-90 0Z"
          :fill="walls"
        />
        <path d="M48 74h64v10H48Z" fill="#91785e" />
      </template>
      <template v-else-if="form === 'springs'">
        <path d="M14 110V96h132v14Z" :fill="walls" />
        <ellipse cx="80" cy="96" rx="66" ry="9" />
        <path d="M34 92V80h92v12Z" :fill="walls" />
        <ellipse cx="80" cy="80" rx="46" ry="7" />
        <path d="M52 77V66h56v11Z" :fill="walls" />
        <ellipse cx="80" cy="66" rx="28" ry="5" />
        <path
          d="M70 58q-6-8 0-16t0-16M90 58q-6-8 0-16t0-16"
          fill="none"
          stroke="#f4f1ea"
          stroke-width="4"
        />
        <path d="M8 104V72m144 32V72" stroke-width="2" />
        <circle cx="8" cy="69" r="5" fill="#e8bf79" />
        <circle cx="152" cy="69" r="5" fill="#e8bf79" />
      </template>
      <template v-else-if="form === 'lotus'">
        <path d="M26 112v-7h108v7Z" :fill="walls" />
        <path d="M44 105V64m18 41V62m36 43V62m18 43V64" stroke="#f4ead5" stroke-width="5" />
        <path d="M80 62C60 50 30 52 16 64c24 4 46 2 64-2Zm0 0c20-12 50-10 64 2-24 4-46 2-64-2Z" />
        <path
          d="M80 62C66 46 56 30 58 16c13 10 22 26 22 46Zm0 0c14-16 24-32 22-46-13 10-22 26-22 46Z"
          fill="#f4ead5"
        />
        <ellipse cx="80" cy="46" rx="8" ry="15" fill="#f5ddb0" />
        <circle cx="53" cy="74" r="4" fill="#e8bf79" />
        <circle cx="107" cy="74" r="4" fill="#e8bf79" />
      </template>
      <template v-else-if="form === 'spire'">
        <path d="m48 113 26-95h12l26 95M59 80h42M67 51h26" fill="none" stroke-width="5" />
        <ellipse cx="80" cy="27" rx="25" ry="8" />
        <ellipse cx="80" cy="64" rx="27" ry="8" fill="none" stroke-width="4" />
      </template>
      <template v-else-if="form === 'orbits'">
        <ellipse cx="80" cy="102" rx="56" ry="10" fill="#8caf80" />
        <path d="M80 102V40" stroke-width="4" />
        <circle cx="80" cy="34" r="12" fill="#cc954f" />
        <ellipse cx="80" cy="46" rx="44" ry="10" fill="none" stroke-width="2" />
        <circle cx="122" cy="48" r="6" fill="#9c86d0" />
        <circle cx="44" cy="44" r="5" fill="#5fb8a8" />
      </template>
      <template v-else-if="form === 'comet'">
        <path d="M40 110V64a40 40 0 0 1 80 0v46h-12V64a28 28 0 0 0-56 0v46Z" />
        <circle cx="116" cy="20" r="9" fill="#fff3c8" />
        <circle
          v-for="n in 5"
          :key="n"
          :cx="116 - n * 11"
          :cy="20 + n * 4"
          :r="7 - n"
          fill="#cc954f"
        />
      </template>
      <template v-else-if="form === 'aurora'">
        <path d="M34 110V92h92v18Z" :fill="walls" />
        <path d="M38 92a42 40 0 0 1 84 0Z" fill="#a0ccc4" />
        <path
          d="M44 40q16-30 30 0M70 30q16-30 30 0M96 40q16-30 30 0"
          fill="none"
          stroke-width="7"
        />
      </template>
      <template v-else-if="form === 'lantern-walk'">
        <g v-for="x in [42, 66, 94, 118]" :key="x">
          <path :d="`M${x} 110V54`" stroke-width="3" />
          <circle :cx="x - 5" cy="52" r="5" />
          <circle :cx="x + 5" cy="52" r="5" fill="#f0c45a" />
        </g>
        <path d="M40 44q40-34 80 0" fill="none" stroke-width="5" />
      </template>
      <template v-else-if="form === 'globes'">
        <ellipse cx="80" cy="100" rx="50" ry="12" :fill="walls" />
        <ellipse cx="80" cy="96" rx="44" ry="9" fill="#7fc0d0" />
        <path d="M62 96V56M104 96V66" stroke-width="4" />
        <circle cx="62" cy="40" r="16" />
        <path d="M54 34q8-6 14 2" fill="none" stroke="#8caf80" stroke-width="5" />
        <circle cx="104" cy="56" r="11" fill="#f1eee6" />
      </template>
      <template v-else-if="form === 'welcome-arch'">
        <path d="M34 110V28h14v82ZM112 110V28h14v82Z" :fill="walls" />
        <path d="M28 20h104v14H28Z" />
        <path d="M50 54h4v26h-4ZM106 54h4v26h-4Z" />
        <circle cx="72" cy="12" r="7" fill="#4f8fc7" />
        <circle cx="88" cy="12" r="5" fill="#f1eee6" />
        <path d="M60 106h40v-8H60Z" fill="#b88757" />
      </template>
      <template v-else>
        <path d="M54 112V77h52v35ZM59 77V48h42v29ZM64 48V22h32v26Z" :fill="walls" />
        <circle cx="80" cy="36" r="12" fill="#fff8e8" />
        <path d="M80 27v10l7 4" fill="none" />
        <path d="m57 22 23-15 23 15Z" />
      </template>
    </g>
    <g v-if="lunar && !mineral && level >= 2" stroke="#e5e8e7" stroke-width="2">
      <path d="M12 108V94h24v10Zm112-4V94h24v14Z" :fill="option.colour" />
      <path v-if="level >= 3" d="M20 91V78m120 13V78" stroke="#eacb80" stroke-width="4" />
      <path v-if="level >= 4" d="M18 94V48m124 46V48" />
      <path
        v-if="level >= 5"
        d="M18 48h124M65 48l4-15 5 15m2 0 4-22 5 22m2 0 4-15 5 15"
        :fill="option.colour"
      />
    </g>
    <g v-if="active && !lunar" class="landmark-fountain">
      <ellipse cx="80" cy="119" :rx="timeless ? 20 : 13" ry="5" fill="#ddd1b5" stroke="#91785e" />
      <ellipse cx="80" cy="117" :rx="timeless ? 17 : 10" ry="3" fill="#a0ccc4" />
      <path
        class="landmark-water"
        d="M72 115q-3-20 8-22 11 2 8 22M80 116V90"
        fill="none"
        stroke="#80bebd"
        stroke-width="2"
      />
    </g>
    <path
      v-if="!timeless && !lunar && !mineral && level >= 5"
      d="M38 117V92q42-24 84 0v25M38 94V84M122 94V84"
      fill="none"
      stroke="#cc954f"
      stroke-width="3"
    />
    <g v-if="scaffold" class="landmark-scaffold" fill="none" stroke-linecap="round">
      <path d="M26 116V22M54 116V22M106 116V22M134 116V22" stroke="#9a754c" stroke-width="2.5" />
      <path d="M22 96h116M22 74h116M22 52h116M22 30h116" stroke="#c2a16b" stroke-width="3.5" />
      <path d="M26 96 54 74M106 74l28-22M54 52 26 30M134 30l-28 22" stroke="#a8835a" />
    </g>
  </svg>
</template>
<script setup>
import { computed, useId } from 'vue';
import { MOONSTONE_LANDMARK_FORMS } from '../../game/town/TownMoonstoneLandmarks';
import { LANDMARK_BY_ID, PERSONAL_AREAS, LANDMARK_PROGRESSION } from '../../data/townLandmarks';
import { settlementOf } from '../../data/settlements';
const props = defineProps({
  choice: { type: String, required: true },
  stage: { type: Number, default: 1 },
  paint: { type: Object, default: () => ({}) },
  // A level still under construction stands inside scaffolding.
  scaffold: Boolean,
  map: Boolean,
});
const option = computed(() => ({
  ...LANDMARK_BY_ID[props.choice],
  colour: props.paint?.roof || LANDMARK_BY_ID[props.choice].colour,
}));
const form = computed(() => option.value.form);
const mineral = computed(() => MOONSTONE_LANDMARK_FORMS.includes(form.value));
// The site's settlement (settlements.js): its own sky and stone.
const settlement = computed(() =>
  settlementOf(PERSONAL_AREAS.find((area) => area.choices.includes(props.choice))),
);
const lunar = computed(() => settlement.value.art === 'moon');
// The town's paint, or the settlement's stone and the trim and brass every unpainted
// monument shares.
const walls = computed(() => props.paint?.walls || settlement.value.monumentStone);
const trim = computed(() => props.paint?.trim || '#655343');
const accent = computed(() => props.paint?.accent || '#cc954f');
const timeless = computed(
  () => PERSONAL_AREAS.find((area) => area.choices.includes(props.choice))?.timeless,
);
const level = computed(() =>
  Math.max(1, Math.min(LANDMARK_PROGRESSION.levels.length, props.stage)),
);
const active = computed(() => timeless.value || level.value >= LANDMARK_PROGRESSION.animationLevel);
const gradient = useId();
</script>

<style scoped>
.landmark-active .landmark-orbits {
  transform-origin: 80px 54px;
  animation: monument-orbit 18s linear infinite;
}
.landmark-active .landmark-wing {
  transform-origin: 80px 55px;
  animation: monument-sway 5s ease-in-out infinite alternate;
}
.landmark-active .landmark-bough {
  transform-box: fill-box;
  transform-origin: bottom center;
  animation: monument-sway 4s ease-in-out infinite alternate;
}
.landmark-active .landmark-glint {
  animation: monument-glint 3s ease-in-out infinite alternate;
}
.landmark-water {
  transform-origin: 80px 117px;
  animation: monument-water 2.4s ease-in-out infinite alternate;
}
@keyframes monument-orbit {
  to {
    transform: rotate(360deg);
  }
}
@keyframes monument-sway {
  to {
    transform: rotate(5deg);
  }
}
@keyframes monument-glint {
  to {
    opacity: 0.45;
  }
}
@keyframes monument-water {
  to {
    transform: scaleY(0.65);
  }
}
@media (prefers-reduced-motion: reduce) {
  .personal-design-art * {
    animation: none !important;
  }
}
</style>
