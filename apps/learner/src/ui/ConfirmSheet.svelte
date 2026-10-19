<script lang="ts">
  interface Props {
    message: string;
    yes: string;
    no: string;
    onyes: () => void;
    onno: () => void;
  }

  let { message, yes, no, onyes, onno }: Props = $props();
</script>

<div class="sheet" role="alertdialog" aria-label={message}>
  <p>{message}</p>
  <div class="row">
    <button type="button" class="yes" onclick={onyes}>{yes}</button>
    <button type="button" onclick={onno}>{no}</button>
  </div>
</div>

<style>
  .sheet {
    position: fixed;
    inset: auto 0 0;
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    background: var(--color-card);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 20%);
  }

  p {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  button {
    flex: 1;
    min-height: 48px;
    border: 1.5px solid var(--color-line);
    border-radius: 14px;
    background: var(--color-card);
    font-weight: 600;
  }

  .yes {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }
</style>
