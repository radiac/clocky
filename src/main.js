const alertAudio = new Audio('/assets/alert.mp3');

function msToTime(duration) {
  let sign = '';
  if (duration < 0) {
    sign = '-';
    duration = Math.abs(duration);
  }
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = hours.toString().padStart(2, "0");
  minutes = minutes.toString().padStart(2, "0");
  seconds = seconds.toString().padStart(2, "0");

  return `${sign}${hours}:${minutes}:${seconds}`;
}


class Clock{
  constructor(el) {
    this.el = el;
    this.refresh();
  }
  refresh() {
    const now = new Date();
    let hours = now.getHours().toString().padStart(2, "0");
    let minutes = now.getMinutes().toString().padStart(2, "0");
    this.el.textContent = `${hours}:${minutes}`;
  }
  tick() {
    this.refresh();
  }
}

class Timer {
  manager = null;
  constructor(title, when) {
    this.title = title;
    this.setTime(when);
  }

  setTime(when) {
    this.when = when;
    this.expired = false;

    this.due = new Date();

    if (when.startsWith('+')) {
      let min = 0;
      if (when.indexOf(':')) {
        let hr_s, min_s = when.split(':');
        min = (parseInt(hr_s, 10) * 60) + parseInt(min_s, 10);
      } else {
        min = parseInt(when);
      }
      this.due = new Date(this.due.getTime() + (min * 60 * 1000));
      this.due.setSeconds(0, 0);

    } else {
      let hr_s, min_s;
      if (when.indexOf(':') !== -1) {
        [hr_s, min_s] = when.split(':', 2);
        if (!min_s) {
          min_s = '0';
        }
      } else {
        hr_s = '0';
        min_s = when;
      }
      this.due.setHours(parseInt(hr_s, 10), parseInt(min_s, 10), 0, 0);

      // If before, move to tomorrow
      if (this.due.getTime() < (new Date()).getTime()) {
        this.due = new Date(this.due.getTime() + (24 * 60 * 60 * 1000));
      }
    }
  }

  render(con) {
    this.con = con;
    this.el = document.querySelector("template[name='timer']").content.querySelector('.timer').cloneNode(true);
    this.titleEl = this.el.querySelector("h2");
    this.whenEl = this.el.querySelector("time");
    this.leftEl = this.el.querySelector("p");
    this.closeEl = this.el.querySelector("button[name='close']");
    this.con.appendChild(this.el);
    this.closeEl.addEventListener("click", e => {this.close()});
    this.redraw();
  }

  redraw() {
    this.titleEl.textContent = this.title;
    this.whenEl.textContent = this.when;
    this.tick();
  }

  tick() {
    const remaining = this.due.getTime() - (new Date()).getTime();
    this.leftEl.textContent = msToTime(remaining);

    // Set progress var for styling
    const warn = 15;
    let progress;
    if (remaining > 0) {
      // min() of remaining minutes or 30, expressed as a percentage 0.0-1.0
      progress = (Math.min((remaining / 1000 / 60), warn) / warn);
    } else {
      if (!this.expired) {
        this.expired = true;
        alertAudio.play();
      }

      // flick on and off
      progress = Math.abs(Math.floor(remaining / 1000) % 2);
    }
    this.el.style.setProperty("--progress", progress);
  }

  close() {
    this.el.remove();
    if (this.manager) {
      this.manager.remove(this);
    }
  }
}

class Stopwatch extends Timer {
  constructor(title, when) {
    super(title || "Stopwatch", null);
  }

  setTime(when) {
    this.due = new Date();
    this.due.setMilliseconds(0);
  }

  render(con) {
    super.render(con);
    this.el.classList.add('stopwatch');

    const now = this.due = new Date();
    now.setMilliseconds(0);
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    this.leftEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  tick() {
    const since = (new Date()).getTime() - this.due.getTime();
    this.whenEl.textContent = msToTime(since);
  }


}


class Editor {
  constructor(el) {
    this.manager = null;
    this.el = el;
    this.titleEl = el.querySelector('input[name="title"]');
    this.whenEl = el.querySelector('input[name="when"]');
    this.addEl = el.querySelector('button[name="save"]');

    this.el.addEventListener("focusin", e => {
      // If focus is moving from one child to another (e.relatedTarget is losing focus)
      if (this.el.contains(e.relatedTarget)) {
        return;
      }
      this.titleEl.focus();
    });

    this.el.addEventListener("focusout", e => {

      // If focus is not going to another child (e.relatedTarget is gaining focus)
      if (!this.el.contains(e.relatedTarget)) {
        this.el.classList.remove("open");
        this.clear();
      }
    });

    this.addEl.addEventListener("click", e => {
      this.save();
    });

    this.el.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        this.save();
      }
    });

  }

  open() {
    this.el.classList.add("open");
    this.titleEl.focus();
  }

  save() {
    if (!this.manager) {
      return;
    }

    let title = this.titleEl.value;
    let when = this.whenEl.value;
    let cls = when ? Timer : Stopwatch;

    let timer = new cls(title, when);
    this.manager.add(timer);
    this.clear();

    // Old behaviour was to deselect it, now we want to re-select to add another
    //document.activeElement.blur();
    this.titleEl.focus();
  }

  clear() {
    this.titleEl.value = "";
    this.whenEl.value = "";
  }
}

class Manager {
  constructor(con, editor, clock) {
    this.con = con;
    this.editor = editor;
    this.clock = clock;
    this.editor.manager = this;
    this.timers = [];
    setInterval(() => {this.tick()}, 500);
  }

  add(timer) {
    this.timers.push(timer);
    timer.manager = this;
    timer.render(this.con);
    this.sort();
  }

  sort() {
    this.timers.sort((a, b) => {
      return b.due.getTime() - a.due.getTime();
    });

    for (let i=0; i<this.timers.length; i++) {
      this.editor.el.after(this.timers[i].el);
    }
  }

  tick() {
    this.clock.tick();
    this.timers.forEach(timer => {timer.tick()});
  }

  remove(timer) {
    let index = this.timers.indexOf(timer);
    if (index !== -1) {
      this.timers.splice(index, 1);
    }
    this.sort();
  }
}


window.addEventListener("DOMContentLoaded", () => {
  const body = document.body;

  const clock = new Clock(body.querySelector('.clock h1'));

  const timers = body.querySelector('.timers');
  const editor = new Editor(timers.querySelector('.editor'));
  const manager = new Manager(timers, editor, clock);
  editor.open();
});
