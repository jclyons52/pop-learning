/* ===========================================================
   Pop Learning — shared content datasets
   Keeping word/phonics lists in one place so each game is thin
   and content is easy to extend. Loads after pop.js.
   =========================================================== */
(function (global) {
  "use strict";

  // Letters: [UPPER, word, emoji]
  var letters = [
    ["A","apple","🍎"],["B","ball","⚽"],["C","cat","🐱"],["D","dog","🐶"],
    ["E","egg","🥚"],["F","fish","🐟"],["G","goat","🐐"],["H","hat","🎩"],
    ["I","insect","🐜"],["J","juice","🧃"],["K","kite","🪁"],["L","lion","🦁"],
    ["M","moon","🌙"],["N","nest","🪺"],["O","orange","🍊"],["P","pig","🐷"],
    ["Q","queen","👑"],["R","rabbit","🐰"],["S","snake","🐍"],["T","tree","🌳"],
    ["U","umbrella","☂️"],["V","van","🚐"],["W","web","🕸️"],["X","fox","🦊"],
    ["Y","yo-yo","🪀"],["Z","zebra","🦓"]
  ];

  // letter -> approximate spoken sound for the speech engine
  var sounds = {
    a:"ah", b:"buh", c:"kuh", d:"duh", e:"eh", f:"ff", g:"guh", h:"huh",
    i:"ih", j:"juh", k:"kuh", l:"ll", m:"mm", n:"nn", o:"o", p:"puh",
    q:"kwuh", r:"rr", s:"sss", t:"tuh", u:"uh", v:"vv", w:"wuh", x:"ks",
    y:"yuh", z:"zz"
  };

  // CVC words: [word, emoji]
  var cvc = [
    ["cat","🐱"],["dog","🐶"],["pig","🐷"],["hat","🎩"],["sun","☀️"],["bus","🚌"],
    ["cup","🥤"],["bed","🛏️"],["fox","🦊"],["box","📦"],["jam","🍓"],["bug","🐛"],
    ["hen","🐔"],["web","🕸️"],["van","🚐"],["pot","🍲"],["map","🗺️"],["net","🥅"]
  ];

  // Word families: { rime, words:[onset, word, emoji] }
  var families = [
    { rime:"at", words:[ ["c","cat","🐱"],["h","hat","🎩"],["b","bat","🦇"],["r","rat","🐀"] ] },
    { rime:"an", words:[ ["p","pan","🍳"],["v","van","🚐"],["c","can","🥫"],["f","fan","🪭"] ] },
    { rime:"ig", words:[ ["p","pig","🐷"],["w","wig","💇"],["d","dig","⛏️"],["f","fig","🟣"] ] },
    { rime:"og", words:[ ["d","dog","🐶"],["l","log","🪵"],["f","fog","🌫️"],["j","jog","🏃"] ] },
    { rime:"en", words:[ ["h","hen","🐔"],["p","pen","🖊️"],["t","ten","🔟"],["m","men","👬"] ] },
    { rime:"un", words:[ ["s","sun","☀️"],["b","bun","🍞"],["r","run","🏃"],["f","fun","🎉"] ] }
  ];

  // Sight word sets (Australian "Magic Words" style): [word, sentence]
  var sightSets = [
    [ ["the","Pat the dog."],["I","I can run."],["a","I see a cat."],["to","Go to bed."],
      ["and","Mum and Dad."],["is","It is hot."],["we","We can play."],["can","I can jump."],
      ["see","I can see you."],["go","Let's go now."],["you","I like you."],["me","Look at me."],
      ["my","This is my hat."],["up","Look up high."],["look","Look at the dog."],["it","It is fun."],
      ["in","Get in the car."],["here","Come over here."],["play","Let's play now."],["like","I like cake."] ],
    [ ["he","He is big."],["was","It was fun."],["are","We are happy."],["for","This is for you."],
      ["little","A little mouse."],["they","They can run."],["said","Mum said yes."],["come","Come and play."],
      ["big","A big red bus."],["down","Sit down here."],["on","Get on the bus."],["mum","I love Mum."],
      ["dad","Dad is tall."],["went","We went home."],["at","Look at this."],["no","No, thank you."],
      ["yes","Yes, please!"],["cat","The cat sat."],["dog","My dog can run."],["am","I am five."] ],
    [ ["this","This is my book."],["us","Come with us."],["get","Get the ball."],["not","I can not see."],
      ["too","Me too!"],["day","It is a sunny day."],["all","We ate it all."],["her","Give it to her."],
      ["him","Give it to him."],["has","She has a hat."],["had","I had fun."],["out","Go out to play."],
      ["will","I will help."],["one","I see one bird."],["two","I have two hands."],["three","Count to three."],
      ["red","A red apple."],["blue","The blue sky."],["run","I can run fast."],["jump","Jump up high!"] ]
  ];

  // Digraphs: [digraph, word, emoji, spokenSound]
  var digraphs = [
    ["sh","ship","🚢","shh"],["ch","chair","🪑","ch"],["th","thumb","👍","th"],
    ["wh","whale","🐳","wh"],["ck","sock","🧦","kuh"],["ng","ring","💍","ng"],
    ["qu","queen","👑","kwuh"]
  ];

  // Consonant blends: [blend, word, emoji]
  var blends = [
    ["bl","block","🧱"],["cl","clock","🕐"],["fl","flag","🏁"],["gl","glass","🥛"],
    ["pl","plane","✈️"],["sl","slide","🛝"],["br","bread","🍞"],["cr","crab","🦀"],
    ["dr","drum","🥁"],["fr","frog","🐸"],["gr","grapes","🍇"],["tr","train","🚆"],
    ["sn","snail","🐌"],["sp","spider","🕷️"],["st","star","⭐"],["sw","swan","🦢"]
  ];

  // Magic-e (split digraph): [short, longWord, emoji]
  var magicE = [
    ["cap","cape","🦸"],["kit","kite","🪁"],["cub","cube","🧊"],["pin","pine","🌲"],
    ["man","mane","🦁"],["tap","tape","📼"],["not","note","🎵"],["bon","bone","🦴"],
    ["rip","ripe","🍑"],["hug","huge","🐘"]
  ];

  // Vowel teams: [team, word, emoji]
  var vowelTeams = [
    ["ai","rain","🌧️"],["ay","tray","🍽️"],["ee","bee","🐝"],["ea","leaf","🍃"],
    ["oa","boat","⛵"],["ow","snow","☃️"],["oo","moon","🌙"],["igh","light","💡"],
    ["ar","star","⭐"],["or","corn","🌽"]
  ];

  // Decodable sentences (CVC + early sight words)
  var sentences = [
    "The cat sat on the mat.",
    "A big dog can run.",
    "I can see a red fish.",
    "Mum has a hot bun.",
    "The sun is up.",
    "Dad and I run up the hill.",
    "Pat the pig in the pen.",
    "We go to the big bus.",
    "The fox is in the box.",
    "I like to play in the sun."
  ];

  // Mini decodable stories with one comprehension question.
  // { lines:[...], q, options:[...], answer }
  var stories = [
    { lines:["Sam has a dog.","The dog is big.","The dog can run fast."],
      q:"What can the dog do?", options:["run fast","go to bed","read a book"], answer:0 },
    { lines:["Pip is a cat.","Pip sat on a mat.","The mat is red."],
      q:"What colour is the mat?", options:["red","blue","green"], answer:0 },
    { lines:["I see a fox.","The fox is in a box.","The box is big."],
      q:"Where is the fox?", options:["in a box","up a tree","on the bus"], answer:0 },
    { lines:["Mum had a bun.","The bun was hot.","Mum gave it to me."],
      q:"Who got the bun?", options:["me","Dad","the dog"], answer:0 },
    { lines:["We run to the bus.","The bus is big and red.","We get on the bus."],
      q:"What colour is the bus?", options:["red","yellow","blue"], answer:0 }
  ];

  // Year 1 Phonics Screening Check style: real + pseudo (made-up) words.
  // { word, real }
  var phonicsCheck = [
    { word:"cat", real:true },{ word:"sit", real:true },{ word:"mud", real:true },
    { word:"leg", real:true },{ word:"fish", real:true },{ word:"chop", real:true },
    { word:"ship", real:true },{ word:"thin", real:true },{ word:"frog", real:true },
    { word:"vap", real:false },{ word:"nin", real:false },{ word:"jod", real:false },
    { word:"fim", real:false },{ word:"zog", real:false },{ word:"quib", real:false },
    { word:"splosh", real:false },{ word:"thrip", real:false },{ word:"chom", real:false }
  ];

  // Number words 1..20
  var numberWords = ["one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];

  // Object emojis used for counting/quantity games
  var countObjects = ["🍎","⭐","🐟","🎈","🍓","🐤","🌸","🚗","🐞","🍊",
    "🦋","🐠","🌼","🍇","🐧","🍪","🌟","🐬","🍉","🐝"];

  // Shapes: [name, emoji-ish svg key]
  var shapes = [
    { name:"circle" },{ name:"square" },{ name:"triangle" },
    { name:"rectangle" },{ name:"star" },{ name:"heart" }
  ];

  global.Pop = global.Pop || {};
  global.Pop.data = {
    letters: letters, sounds: sounds, cvc: cvc, families: families,
    sightSets: sightSets, digraphs: digraphs, blends: blends, magicE: magicE,
    vowelTeams: vowelTeams, sentences: sentences, stories: stories,
    phonicsCheck: phonicsCheck, numberWords: numberWords, countObjects: countObjects,
    shapes: shapes
  };
})(window);
