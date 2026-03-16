#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("gh-secrets-check")
  .description("Lint GitHub Actions workflows for secret misuse")
  .version("0.1.0");

program.parse();
