(() => {
  const root = document.querySelector('[data-robot-lab]');
  if (!root) return;

  const missions = [
    {
      kicker: 'Mission 1 · Systems detective',
      title: 'Which team closes the feedback loop?',
      prompt: 'ROB turns toward a box, but must measure the result before deciding again. Which subsystem provides the new evidence?',
      diagram: '<div class="loop"><b>Goal</b><i>→</i><b>Compare</b><i>→</i><b>Act</b><i>→</i><b class="loop__missing">?</b><i>↺</i></div>',
      choices: ['Structure', 'Energy storage', 'Sensors', 'Decorative shell'],
      answer: 2,
      explain: 'Sensors translate a physical effect into fresh data. The computer can compare that evidence with the remembered goal. A sensor does not “know” the box by itself; software interprets measurements within limits.'
    },
    {
      kicker: 'Mission 2 · Signal laboratory',
      title: 'Which trace changes average motor effort?',
      prompt: 'The pulse height and repetition period stay the same. Which symbolic PWM trace has the greatest duty cycle?',
      diagram: '<div class="waves"><span class="wave wave--25"></span><span class="wave wave--50"></span><span class="wave wave--75"></span></div>',
      choices: ['Top trace', 'Middle trace', 'Bottom trace', 'They are identical'],
      answer: 2,
      explain: 'The bottom trace spends the largest fraction of each period active, so it has the greatest duty cycle. Duty cycle and frequency are different properties. A motor still needs a proper driver; a logic pin does not supply traction power.'
    },
    {
      kicker: 'Mission 3 · Motion workshop',
      title: 'Predict ROB’s path',
      prompt: 'Looking from above, the left tread moves forward quickly while the right tread moves forward slowly. What does the ideal differential-drive model predict?',
      diagram: '<div class="drive"><span class="drive__left">↑ ↑ ↑</span><b>ROB</b><span class="drive__right">↑</span><svg viewBox="0 0 180 70" aria-hidden="true"><path d="M25 58 C75 58 132 43 154 9"/></svg></div>',
      choices: ['Straight ahead', 'Curve toward the slower right side', 'Curve toward the faster left side', 'Spin in place'],
      answer: 1,
      explain: 'The faster left side travels farther, so the ideal model curves toward the slower right side. Real treads also scrub and slip; surface, load, geometry, and friction limit the model.'
    },
    {
      kicker: 'Mission 4 · Mission control',
      title: 'Should this command reach motion?',
      prompt: 'A paired operator sends an in-range command, but its lease expired before it reached Cerebro. What should the validator do?',
      diagram: '<div class="gates"><b>Identity ✓</b><i>→</i><b>Role ✓</b><i>→</i><b class="gates__stop">Freshness ✕</b><i>→</i><b>Motion?</b></div>',
      choices: ['Apply it because identity is valid', 'Apply half speed', 'Reject it and keep or enter the defined safe state', 'Ask the camera to decide'],
      answer: 2,
      explain: 'Authentication proves identity; it does not make an old command current. Expired intent must be rejected. Freshness, authorization, value bounds, watchdogs, and physical stopping are separate safety layers.'
    },
    {
      kicker: 'Mission 5 · USB Power Lab · Make safe',
      title: 'What must happen before the cable is opened?',
      prompt: 'A mentor has a sacrificial USB-A cable for the Maker Faire toy experiment. Choose the only safe preparation state.',
      diagram: '<div class="usb-sequence"><b class="usb-sequence__safe">UNPLUG</b><i>→</i><b>MENTOR OPENS JACKET</b><i>→</i><b>SEPARATE + INSULATE</b><i>→</i><b>VERIFY</b></div>',
      choices: ['Leave it connected so the meter can see 5 V', 'Unplug both ends; only the mentor cuts and strips it', 'Let each learner cut through the whole cable', 'Use ROB’s installed USB cable'],
      answer: 1,
      explain: 'Cutting and stripping happen only while both ends are unplugged, at an adult-only tool station. Use a sacrificial cable—not ROB’s wiring or a valuable device cable. Power is connected later, after conductors are separated, insulated, and ready for controlled measurement.'
    },
    {
      kicker: 'Mission 6 · USB Power Lab · Conductor detective',
      title: 'Which pair may carry energy to the toy?',
      prompt: 'A typical USB 2.0 cable has red, black, white, and green insulated conductors. Which plan is correct before the mentor verifies it with a meter?',
      diagram: '<div class="usb-wires"><span class="usb-wire usb-wire--red">usual +5 V</span><span class="usb-wire usb-wire--black">usual GND</span><span class="usb-wire usb-wire--white">usual Data −</span><span class="usb-wire usb-wire--green">usual Data +</span></div>',
      choices: ['Red and black are candidate power wires; cap white and green separately, then verify', 'Green and white power the toy because data means energy', 'Twist all four together for more current', 'Wire color proves everything, so measurement is unnecessary'],
      answer: 0,
      explain: 'Red and black are common +5 V and GND conventions, but colors are clues rather than proof. A mentor verifies voltage and polarity. White and green usually carry data and are insulated separately; a shield or drain must also be secured so nothing can short.'
    },
    {
      kicker: 'Mission 7 · USB Power Lab · Match the load',
      title: 'Which toy is the best candidate?',
      prompt: 'The approved source supplies current-limited 5 V. Which load should the mentor investigate for the bounded demonstration?',
      diagram: '<div class="load-cards"><b>2 × AA<br><small>about 3 V</small></b><b class="load-cards__candidate">3 × AA<br><small>about 4.5 V</small></b><b>9 V<br><small>not 5 V</small></b></div>',
      choices: ['Any toy—the source adjusts automatically', 'A simple, low-current 3-cell toy whose label and startup current the mentor approves', 'A 2-cell 3 V toy because 5 V is close enough', 'A toy with its batteries still installed'],
      answer: 1,
      explain: 'A simple 4.5 V battery toy may be a candidate, but only after its allowed voltage, running current, and motor startup or stall current are reviewed. Remove every battery. Never place USB power in parallel with cells or a charging circuit, and never assume “close” voltage is safe.'
    },
    {
      kicker: 'Mission 8 · USB Power Lab · Close the path',
      title: 'Which circuit is ready for a bounded test?',
      prompt: 'The mentor has verified polarity and disconnected the source again. Choose the complete protected energy path.',
      diagram: '<div class="usb-circuit"><b>5 V source</b><i>→</i><b>protection</b><i>→</i><b>switch</b><i>→</i><b>toy load</b><i>→</i><b>GND return</b></div>',
      choices: ['5 V → covered protection → switch → approved toy → GND, connected while unpowered', '5 V → toy, with GND left open', '5 V and GND twisted together to test the source', '5 V → toy batteries → GND'],
      answer: 0,
      explain: 'A working circuit needs an outward path, a load, and a return. Protection limits a fault, the switch bounds the test, and covered connections prevent accidental contact. After a short run, switch off and disconnect; heat, odor, noise, or unexpected behavior means stop—not bypass the protection.'
    }
  ];

  let index = 0;
  let score = 0;
  let answered = false;
  const el = name => root.querySelector(`[data-lab-${name}]`);

  function render() {
    const mission = missions[index];
    answered = false;
    el('progress').textContent = `${index + 1} / ${missions.length}`;
    el('score').textContent = score;
    el('kicker').textContent = mission.kicker;
    el('title').textContent = mission.title;
    el('prompt').textContent = mission.prompt;
    el('diagram').innerHTML = mission.diagram;
    el('feedback').hidden = true;
    el('next').hidden = true;
    el('choices').replaceChildren(...mission.choices.map((choice, choiceIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice;
      button.addEventListener('click', () => answer(choiceIndex, button));
      return button;
    }));
  }

  function answer(choiceIndex, button) {
    if (answered) return;
    answered = true;
    const mission = missions[index];
    const correct = choiceIndex === mission.answer;
    if (correct) score += 25;
    [...el('choices').children].forEach((choice, i) => {
      choice.disabled = true;
      if (i === mission.answer) choice.classList.add('is-correct');
    });
    if (!correct) button.classList.add('is-wrong');
    el('score').textContent = score;
    el('feedback').className = `robot-lab__feedback ${correct ? 'is-correct' : 'is-revision'}`;
    el('feedback').innerHTML = `<strong>${correct ? 'Evidence supports your model.' : 'Revise the model.'}</strong><p>${mission.explain}</p>`;
    el('feedback').hidden = false;
    el('next').textContent = index === missions.length - 1 ? 'See mission report' : 'Next mission →';
    el('next').hidden = false;
    el('feedback').focus?.();
  }

  function next() {
    if (index < missions.length - 1) {
      index += 1;
      render();
      el('title').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    el('kicker').textContent = 'Mission report';
    el('title').textContent = `${score} evidence points collected`;
    const maximumScore = missions.length * 25;
    el('prompt').textContent = score === maximumScore
      ? 'You used all eight models successfully. Now explain the USB energy path from source to protection to load and back through GND.'
      : 'Engineering is revision. Replay the lab and explain why each rejected model failed.';
    el('diagram').innerHTML = '<div class="report">Observe → Model → Predict → Test → Explain → Revise</div>';
    el('choices').replaceChildren();
    el('feedback').hidden = true;
    el('next').hidden = true;
  }

  function reset() { index = 0; score = 0; render(); }
  el('next').addEventListener('click', next);
  el('reset').addEventListener('click', reset);
  el('start').addEventListener('click', () => el('title').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  render();
})();
