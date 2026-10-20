import Phaser from 'phaser';
import witchImage from '../assets/witch.svg';
import { GAME_SETTINGS } from './settings';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private ingredients: Phaser.GameObjects.Arc[] = [];
  private cauldron!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pauseKeys!: Phaser.Input.Keyboard.Key[];
  private pauseButton!: Phaser.GameObjects.Container;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private phaseText!: Phaser.GameObjects.Text;
  private phaseTimerText!: Phaser.GameObjects.Text;
  private phaseDetailsText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private heatText!: Phaser.GameObjects.Text;
  private heatBar!: Phaser.GameObjects.Rectangle;
  private resultText!: Phaser.GameObjects.Text;
  private heat: number = GAME_SETTINGS.heatMax;
  private collected = 0;
  private phaseTwo = false;
  private paused = false;
  private gameOver = false;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('witch', witchImage);
  }

  create(): void {
    const { width, height } = this.scale;
    this.heat = GAME_SETTINGS.heatMax;
    this.collected = 0;
    this.phaseTwo = false;
    this.paused = false;
    this.gameOver = false;
    this.ingredients = [];

    this.pauseButton = this.add
      .container(24, 20)
      .setDepth(1)
      .setSize(112, 40)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePause());
    this.pauseButton.add([
      this.add.rectangle(56, 20, 112, 40, 0x475569).setOrigin(0.5),
      this.add.text(56, 20, 'ПАУЗА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5),
    ]);

    this.add
      .text(width / 2, 20, 'Ведьма и остывающий котёл', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 58, 'Стрелки / WASD — движение   P / Esc — пауза', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0);

    this.cauldron = this.add.circle(width - 90, 52, 24, 0x7c3aed);
    this.add
      .text(width - 90, 52, 'КОТЁЛ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.player = this.add.image(70, 150, 'witch').setDisplaySize(64, 72);
    for (let i = 0; i < GAME_SETTINGS.ingredientsOnField; i += 1) {
      this.spawnIngredient();
    }
    this.phaseText = this.add.text(24, height - 188, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });
    this.phaseTimerText = this.add.text(24, height - 164, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
    });
    this.phaseDetailsText = this.add.text(24, height - 140, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#cbd5e1',
    });
    this.progressText = this.add.text(24, height - 112, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });
    this.heatText = this.add.text(24, height - 76, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });
    this.heatBar = this.add
      .rectangle(24, height - 42, GAME_SETTINGS.heatBarWidth, 16, 0xf97316)
      .setOrigin(0, 0.5);
    this.resultText = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    this.updateHud();

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.pauseKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    ];
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    if (this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.togglePause();
    }
    if (this.paused) return;

    const seconds = delta / 1000;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      const speed = this.phaseTwo
        ? GAME_SETTINGS.phaseTwoPlayerSpeed
        : GAME_SETTINGS.playerSpeed;
      this.player.x += (dx / length) * speed * seconds;
      this.player.y += (dy / length) * speed * seconds;
    }

    this.keepPlayerOnScreen();
    const heatDrain = this.phaseTwo
      ? GAME_SETTINGS.phaseTwoHeatDrainPerSecond
      : GAME_SETTINGS.phaseOneHeatDrainPerSecond;
    const heatLoss = heatDrain * seconds;
    this.heat = Math.max(0, this.heat - heatLoss);
    this.updateHud();
    this.checkIngredient();

    if (this.heat <= 0) this.endGame(false);
  }

  private togglePause(): void {
    if (this.gameOver) return;

    this.paused = !this.paused;
    if (this.paused) {
      const overlay = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(10);
      overlay.add([
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x020617, 0.75),
        this.add.text(0, -42, 'Пауза', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '36px',
          color: '#ffffff',
        }).setOrigin(0.5),
      ]);

      const resumeButton = this.add
        .container(0, 32)
        .setSize(220, 56)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePause());
      resumeButton.add([
        this.add.rectangle(0, 0, 220, 56, 0x7c3aed),
        this.add.text(0, 0, 'Продолжить', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#ffffff',
        }).setOrigin(0.5),
      ]);
      overlay.add(resumeButton);
      this.pauseOverlay = overlay;
      return;
    }

    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = null;
  }

  private showPhaseTwoAnnouncement(): void {
    const announcement = this.add
      .container(this.scale.width / 2, this.scale.height / 2)
      .setDepth(5)
      .setAlpha(0)
      .setScale(0.7);
    announcement.add([
      this.add.text(0, -12, 'ФАЗА 2', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: '#fbbf24',
        stroke: '#3b0764',
        strokeThickness: 8,
        fontStyle: 'bold',
      }).setOrigin(0.5),
      this.add.text(0, 34, 'Испытание', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#3b0764',
        strokeThickness: 5,
      }).setOrigin(0.5),
    ]);

    this.tweens.add({
      targets: announcement,
      alpha: 1,
      scale: 1,
      duration: 350,
      yoyo: true,
      hold: 1400,
      onComplete: () => announcement.destroy(),
    });
  }

  private keepPlayerOnScreen(): void {
    const halfWidth = this.player.width / 2;
    const halfHeight = this.player.height / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x, halfWidth, this.scale.width - halfWidth);
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      110 + halfHeight,
      this.scale.height - halfHeight,
    );
  }

  private checkIngredient(): void {
    for (let i = this.ingredients.length - 1; i >= 0; i -= 1) {
      const ingredient = this.ingredients[i];
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        ingredient.x,
        ingredient.y,
      );

      if (distance > 36) continue;

      ingredient.destroy();
      this.ingredients.splice(i, 1);
      this.collected += 1;

      if (
        !this.phaseTwo &&
        this.collected >= GAME_SETTINGS.phaseTwoProgressThreshold
      ) {
        this.phaseTwo = true;
        this.showPhaseTwoAnnouncement();
      }

      if (this.collected >= GAME_SETTINGS.ingredientsNeeded) {
        this.updateHud();
        this.endGame(true);
        return;
      }
    }

    while (this.ingredients.length < GAME_SETTINGS.ingredientsOnField) {
      this.spawnIngredient();
    }

    this.updateHud();
  }

  private spawnIngredient(): void {
    const margin = 80;
    const ingredient = this.add.circle(
      Phaser.Math.Between(margin, this.scale.width - margin),
      Phaser.Math.Between(130, this.scale.height - margin),
      16,
      0x22c55e,
    );
    this.ingredients.push(ingredient);
  }

  private updateHud(): void {
    this.phaseText.setText(
      this.phaseTwo ? GAME_SETTINGS.phaseTwoName : GAME_SETTINGS.phaseOneName,
    );
    this.phaseText.setColor(this.phaseTwo ? '#fbbf24' : '#ffffff');
    this.phaseTimerText.setText(
      this.phaseTwo
        ? 'Фаза 2 началась'
        : `До фазы 2: ${this.collected} / ${GAME_SETTINGS.phaseTwoProgressThreshold} ингредиентов`,
    );
    this.phaseDetailsText.setText(
      this.phaseTwo
        ? `Скорость: ${GAME_SETTINGS.phaseTwoPlayerSpeed} · котёл теряет ${GAME_SETTINGS.phaseTwoHeatDrainPerSecond}% тепла/с`
        : `Скорость: ${GAME_SETTINGS.playerSpeed} · котёл теряет ${GAME_SETTINGS.phaseOneHeatDrainPerSecond}% тепла/с`,
    );
    this.progressText.setText(
      `Ингредиенты: ${this.collected} / ${GAME_SETTINGS.ingredientsNeeded}`,
    );
    this.heatText.setText(`Тепло котла: ${Math.ceil(this.heat)}%`);
    this.heatBar.width = GAME_SETTINGS.heatBarWidth * (this.heat / GAME_SETTINGS.heatMax);
    this.heatBar.fillColor = this.heat < 30 ? 0xef4444 : 0xf97316;
  }

  private endGame(won: boolean): void {
    this.gameOver = true;
    this.resultText.setText(won ? 'Зелье готово!' : 'Котёл остыл!');
    this.resultText.setColor(won ? '#22c55e' : '#ef4444');

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 54, 'RESTART', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#475569',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());
  }
}
