import { mount } from 'svelte';
import App from './App.svelte';
import './styles/tokens.css';

const target = document.getElementById('app');
if (target) mount(App, { target });
