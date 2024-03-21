/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useCallback, useEffect, useState } from "react";
import { SearchInput } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { If, Section, Selector, ValidationErrors } from "~/components/core";
import PatternGroup from "./PatternGroup";
import PatternItem from "./PatternItem";
import { toValidationError } from "~/utils";
import { _ } from "~/i18n";

/**
 * @typedef {Object} Pattern
 * @property {string} name pattern name (internal ID)
 * @property {string} group pattern group
 * @property {string} summary pattern name (user visible)
 * @property {string} description long description of the pattern
 * @property {string} order display order (string!)
 * @property {string} icon icon name (not path or file name!)
 * @property {number|undefined} selected who selected the pattern, undefined
 *   means it is not selected to install
 */

/**
 * Convert DBus pattern data to JS objects
 * @param {Object.<string, Array<string>>} pattern_data input pattern data
 * @param {PatternSelection} selected selected patterns
 * @returns {Array<Pattern>} converted patterns
 */
function convert(pattern_data, selected) {
  const patterns = [];

  Object.keys(pattern_data).forEach((name) => {
    const pattern = pattern_data[name];

    patterns.push({
      name,
      group: pattern[0],
      description: pattern[1],
      icon: pattern[2],
      summary: pattern[3],
      order: pattern[4],
      selected: selected[name],
    });
  });

  return patterns;
}

/**
 * @typedef {Object.<string, Array<Pattern>} PatternGroups mapping "group name" =>
 * list of patterns
 */

/**
 * Group the patterns with the same group name
 * @param {Array<Pattern>} patterns input
 * @return {PatternGroups}
 */
function groupPatterns(patterns) {
  const groups = {};

  patterns.forEach((pattern) => {
    if (groups[pattern.category]) {
      groups[pattern.category].push(pattern);
    } else {
      groups[pattern.category] = [pattern];
    }
  });

  // sort patterns by the "order" value
  Object.keys(groups).forEach((group) => {
    groups[group].sort((p1, p2) => {
      if (p1.order === p2.order) {
        // there should be no patterns with the same name
        return p1.name < p2.name ? -1 : 1;
      } else {
        return p1.order - p2.order;
      }
    });
  });

  return groups;
}

/**
 * Sort pattern group names
 * @param {PatternGroups} groups input
 * @returns {Array<string>} sorted pattern group names
 */
function sortGroups(groups) {
  return Object.keys(groups).sort((g1, g2) => {
    const order1 = groups[g1][0].order;
    const order2 = groups[g2][0].order;

    if (order1 === order2) {
      return g1 === g2 ? 0 : (g1 < g2 ? -1 : 1);
    }

    // patterns with undefined (empty) order are always at the end
    if (order1 === "") return 1;
    if (order2 === "") return -1;

    return order1 < order2 ? -1 : 1;
  });
}

/**
 * Pattern selector component
 * @component
 * @param {object} props
 * @param {import("~/components/software/SoftwarePage").Pattern[]} props.patterns - list of patterns
 * @param {import("~/client/software").SoftwareProposal} props.proposal - Software proposal
 * @returns {JSX.Element}
 */
function PatternSelector({ patterns, proposal }) {
  const [errors, setErrors] = useState([]);
  const [visiblePatterns, setVisiblePatterns] = useState(patterns);
  const [searchValue, setSearchValue] = useState("");
  const client = useInstallerClient();

  const { patterns: selection, used } = proposal;

  const onSearchChange = (value) => {
    setSearchValue(value);
  };

  useEffect(() => {
    if (!patterns) return;

    // filtering - search the required text in the name and pattern description
    if (searchValue !== "") {
      // case insensitive search
      const searchData = searchValue.toUpperCase();
      const filtered = patterns.filter((p) =>
        p.name.toUpperCase().indexOf(searchData) !== -1 ||
        p.description.toUpperCase().indexOf(searchData) !== -1
      );
      setVisiblePatterns(filtered);
    } else {
      setVisiblePatterns(patterns);
    }
  }, [patterns, searchValue]);

  const onToggle = useCallback((name) => {
    const selected = patterns.filter((p) => p.selected_by === 0).map((p) => p.name);

    const index = selected.indexOf(name);
    if (index === -1) {
      selected.push(name);
    } else {
      selected.splice(index, 1);
    }

    client.software.selectPatterns(selected);
  }, [patterns, client.software]);

  // initial empty screen, the patterns are loaded very quickly, no need for any progress
  if (visiblePatterns.length === 0) return null;

  const groups = groupPatterns(visiblePatterns);

  const renderPatternOption = (pattern) => (
    <>
      <div>
        <b>{pattern.summary}</b>
      </div>
      <div>{pattern.description}</div>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <If condition={pattern.selected_by === 1} then={<div>auto</div>} />
    </>
  );

  const selector = sortGroups(groups).map((groupName) => {
    const selectedIds = groups[groupName].filter((p) => p.selected_by !== 2).map((p) => p.name);
    return (
      <Section
        key={groupName}
        title={groupName}
      >
        <Selector
          isMultiple
          renderOption={renderPatternOption}
          options={groups[groupName]}
          onOptionClick={onToggle}
          optionIdKey="name"
          selectedIds={selectedIds}
          dataItemsType="agama/software-patterns"
        />
      </Section>
    );
  });

  // FIXME: ValidationErrors should be replaced by an equivalent component to show issues.
  // Note that only the Users client uses the old Validation D-Bus interface.
  // const validationErrors = errors.map(toValidationError);
  // <ValidationErrors errors={validationErrors} sectionId="software" />

  return (
    <>
      <Section aria-label={_("Software summary and filter options")}>
        <SearchInput
          // TRANSLATORS: search field placeholder text
          placeholder={_("Search")}
          aria-label={_("Search")}
          value={searchValue}
          onChange={(_event, value) => onSearchChange(value)}
          onClear={() => onSearchChange("")}
          // do not display the counter when search filter is empty
          resultsCount={searchValue === "" ? 0 : groups.length}
        />
      </Section>

      {selector}
    </>
  );
}

export default PatternSelector;
