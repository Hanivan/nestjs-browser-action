#!/usr/bin/env bash
set -e

# Use local ts-node so the script works both via pnpm and directly
TS_NODE="$(pwd)/node_modules/.bin/ts-node"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

EXAMPLES_DIR="src/examples"

EXAMPLES=(
  "container-extraction-example.ts"
  "cookie-persistence-example.ts"
  "pagination-example.ts"
  "pipes-example.ts"
  "workflow-example.ts"
)

run_example() {
  local example_file=$1
  local label=$2

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Running: $label${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if [ ! -f "$EXAMPLES_DIR/$example_file" ]; then
    echo -e "${RED}(x_x) File not found: $EXAMPLES_DIR/$example_file${NC}"
    return 1
  fi

  if "$TS_NODE" -r tsconfig-paths/register "$EXAMPLES_DIR/$example_file"; then
    echo ""
    echo -e "${GREEN}(^_^) $label completed successfully${NC}"
    return 0
  else
    echo ""
    echo -e "${RED}(x_x) $label failed${NC}"
    return 1
  fi
}

if [ $# -eq 0 ]; then
  echo -e "${YELLOW}\\(^o^)/ Running All Examples${NC}"
  echo ""

  FAILED=0
  PASSED=0

  for i in "${!EXAMPLES[@]}"; do
    if run_example "${EXAMPLES[$i]}" "${EXAMPLES[$i]}"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
    fi
    echo ""
  done

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}(^_^) Passed: $PASSED${NC}"
  if [ $FAILED -gt 0 ]; then
    echo -e "${RED}(x_x) Failed: $FAILED${NC}"
    exit 1
  fi
  echo -e "${GREEN}\\(^o^)/ All examples completed successfully!${NC}"

else
  ARG=$1
  if [[ "$ARG" =~ ^[0-9]+$ ]]; then
    IDX=$((ARG - 1))
    if [ $IDX -lt 0 ] || [ $IDX -ge ${#EXAMPLES[@]} ]; then
      echo -e "${RED}(x_x) Example number out of range: $ARG (1-${#EXAMPLES[@]})${NC}"
      exit 1
    fi
    run_example "${EXAMPLES[$IDX]}" "${EXAMPLES[$IDX]}"
  else
    run_example "$ARG" "$ARG"
  fi
fi
